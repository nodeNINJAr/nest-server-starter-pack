import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { UserStatus } from '../../../../prisma/generated/prisma/enums';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: { sub?: unknown; sid?: unknown }) {
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
      throw new UnauthorizedException('Invalid access token');
    }
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      select: { userId: true, revokedAt: true, expiresAt: true },
    });
    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Session has ended');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        phone: true,
        username: true,
        accountStatus: true,
        emailVerified: true,
        roleId: true,
        role: { select: { id: true, name: true } },
      },
    });
    if (!user || user.accountStatus !== UserStatus.active) {
      throw new UnauthorizedException('User not active or does not exist');
    }
    return user;
  }
}
