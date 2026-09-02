import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService, SessionMeta } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from '../../decorators/public.decorator';
import { Auth } from '../../decorators/auth.decorator';
import { CurrentUser } from '../../decorators/currentuser.decorator';
import { ApiResponses } from '../../common/api-responses';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create a new account' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const result = await this.authService.register(dto, this.meta(req));
    return ApiResponses.success(result, 'Account created successfully');
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Log in with username/email + password' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const result = await this.authService.login(dto, this.meta(req));
    return ApiResponses.success(result, 'Logged in successfully');
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Exchange a refresh token for a new access + refresh token pair' })
  async refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    const result = await this.authService.refresh(dto.refreshToken, this.meta(req));
    return ApiResponses.success(result, 'Token refreshed successfully');
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Revoke a refresh token (ends that session)' })
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
    return ApiResponses.success(null, 'Logged out successfully');
  }

  @Auth()
  @Get('me')
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  me(@CurrentUser() user: unknown) {
    return ApiResponses.success(user, 'Current user fetched successfully');
  }

  private meta(req: Request): SessionMeta {
    return {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
  }
}
