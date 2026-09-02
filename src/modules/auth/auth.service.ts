import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../config/datasource/prisma.service';
import { UserRole, UserStatus } from '../../../prisma/generated/prisma/enums';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private sign(userId: string) {
    return this.jwtService.sign({ sub: userId });
  }

  private sanitize<T extends { password: string }>(user: T) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safe } = user;
    return safe;
  }

  async register(dto: RegisterDto) {
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
      accessToken: this.sign(user.id),
    };
  }

  async login(dto: LoginDto) {
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
      accessToken: this.sign(user.id),
    };
  }
}
