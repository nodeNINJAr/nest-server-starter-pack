import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../config/datasource/prisma.service';
import { UserStatus } from '../../prisma/generated/prisma/enums';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'changeme'),
    });
  }

  async validate(payload: any) {
    // Payload contains: { sub: userId, iat, exp }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        phone: true,
        username: true,
        accountStatus: true,
        emailVerified: true,
        devices: {
          select: {
            deviceToken: true,
            preferredLanguage: true,
            platform: true,
          },
        },
        roleId: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user || user.accountStatus !== UserStatus.active) {
      throw new UnauthorizedException('User not active or does not exist');
    }

    return user;
  }
}
