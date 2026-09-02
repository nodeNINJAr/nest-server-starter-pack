import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../config/datasource/prisma.service';
import { UserRole, UserStatus } from '../../../prisma/generated/prisma/enums';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safe } = user;
    return safe;
  }

  /** Signs a short-lived access token and creates a new refresh-token session. */
  private async issueTokens(userId: string, meta: SessionMeta) {
    const accessToken = this.jwtService.sign({ sub: userId }, { expiresIn: ACCESS_TOKEN_TTL });

    const secret = randomBytes(32).toString('hex');
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: await bcrypt.hash(secret, SALT_ROUNDS),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken: `${session.id}.${secret}` };
  }

  async register(dto: RegisterDto, meta: SessionMeta) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });

    if (existing) {
      throw new ConflictException('Email or username already in use');
    }

    // Resilient to a fresh DB that hasn't been seeded yet.
    const role = await this.prisma.role.upsert({
      where: { name: UserRole.user },
      update: {},
      create: { name: UserRole.user },
    });

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        phone: dto.phone,
        password: await bcrypt.hash(dto.password, SALT_ROUNDS),
        roleId: role.id,
      },
      include: { role: { select: { id: true, name: true } } },
    });

    return {
      user: this.sanitize(user),
      ...(await this.issueTokens(user.id, meta)),
    };
  }

  async login(dto: LoginDto, meta: SessionMeta) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.identifier }, { username: dto.identifier }] },
      include: { role: { select: { id: true, name: true } } },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.accountStatus !== UserStatus.active) {
      throw new UnauthorizedException('Account is not active');
    }

    return {
      user: this.sanitize(user),
      ...(await this.issueTokens(user.id, meta)),
    };
  }

  /** Validates a refresh token, revokes it, and issues a fresh access + refresh token pair. */
  async refresh(refreshToken: string, meta: SessionMeta) {
    const session = await this.validateRefreshToken(refreshToken);

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(session.userId, meta);
  }

  async logout(refreshToken: string) {
    const [sessionId] = refreshToken.split('.');
    if (!sessionId) return;

    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async validateRefreshToken(refreshToken: string) {
    const [sessionId, secret] = refreshToken.split('.');

    if (!sessionId || !secret) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!(await bcrypt.compare(secret, session.refreshTokenHash))) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return session;
  }
}
