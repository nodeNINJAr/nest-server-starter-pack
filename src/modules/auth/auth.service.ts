import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UserRole, UserStatus } from '../../../prisma/generated/prisma/enums';
import type { Prisma } from '../../../prisma/generated/prisma/client';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 10;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private sanitize<T extends { password: string }>(user: T) {
    const { password: _password, ...safe } = user;
    return safe;
  }

  private async sessionMaterial() {
    const secret = randomBytes(32).toString('hex');
    return {
      id: randomUUID(),
      secret,
      hash: await bcrypt.hash(secret, SALT_ROUNDS),
    };
  }

  private async issueTokens(
    db: Prisma.TransactionClient,
    userId: string,
    meta: SessionMeta,
    material: Awaited<ReturnType<AuthService['sessionMaterial']>>,
  ) {
    await db.session.create({
      data: {
        id: material.id,
        userId,
        refreshTokenHash: material.hash,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return {
      accessToken: this.jwtService.sign({ sub: userId, sid: material.id }),
      refreshToken: `${material.id}.${material.secret}`,
    };
  }

  async register(dto: RegisterDto, meta: SessionMeta) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Email or username already in use');
    const password = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const material = await this.sessionMaterial();
    // A failed session insert must not leave a partially registered account.
    return this.prisma.$transaction(async (db) => {
      const role = await db.role.upsert({
        where: { name: UserRole.user },
        update: {},
        create: { name: UserRole.user },
      });
      const user = await db.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          phone: dto.phone,
          password,
          roleId: role.id,
        },
        include: { role: { select: { id: true, name: true } } },
      });
      return {
        user: this.sanitize(user),
        ...(await this.issueTokens(db, user.id, meta, material)),
      };
    });
  }

  async login(dto: LoginDto, meta: SessionMeta) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.identifier }, { username: dto.identifier }] },
      include: { role: { select: { id: true, name: true } } },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.accountStatus !== UserStatus.active)
      throw new UnauthorizedException('Account is not active');
    const material = await this.sessionMaterial();
    const tokens = await this.prisma.$transaction((db) =>
      this.issueTokens(db, user.id, meta, material),
    );
    return { user: this.sanitize(user), ...tokens };
  }

  async refresh(refreshToken: string, meta: SessionMeta) {
    const session = await this.validateRefreshToken(refreshToken);
    const material = await this.sessionMaterial();
    return this.prisma.$transaction(async (db) => {
      const now = new Date();
      // Compare-and-set: exactly one concurrent request can consume this session.
      const claimed = await db.session.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
          expiresAt: { gt: now },
          user: { accountStatus: UserStatus.active },
        },
        data: { revokedAt: now },
      });
      if (claimed.count !== 1) throw new UnauthorizedException('Invalid or expired refresh token');
      return this.issueTokens(db, session.userId, meta, material);
    });
  }

  async logout(refreshToken: string) {
    // Possessing only a session ID must never allow revoking someone else's session.
    const session = await this.validateRefreshToken(refreshToken);
    await this.prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async validateRefreshToken(refreshToken: string) {
    const [sessionId, secret, extra] = refreshToken.split('.');
    if (!sessionId || !secret || extra !== undefined) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: { select: { accountStatus: true } } },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.accountStatus !== UserStatus.active ||
      !(await bcrypt.compare(secret, session.refreshTokenHash))
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    return session;
  }
}
