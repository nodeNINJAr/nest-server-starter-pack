import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService, SessionMeta } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from '../../core/security/decorators/public.decorator';
import { Auth } from '../../core/security/decorators/auth.decorator';
import { CurrentUser } from '../../core/security/decorators/currentuser.decorator';
import { ApiResponses } from '../../common/http/api-responses';
import { RateLimit } from '../../core/security/decorators/rate-limit.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @RateLimit(5)
  @ApiOperation({ summary: 'Create a new account' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const result = await this.authService.register(dto, this.meta(req));
    return ApiResponses.success(result, 'Account created successfully');
  }

  @Public()
  @Post('login')
  @RateLimit(10)
  @ApiOperation({ summary: 'Log in with username/email + password' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const result = await this.authService.login(dto, this.meta(req));
    return ApiResponses.success(result, 'Logged in successfully');
  }

  @Public()
  @Post('refresh')
  @RateLimit(30)
  @ApiOperation({
    summary: 'Exchange a refresh token for a new access + refresh token pair',
  })
  async refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    const result = await this.authService.refresh(dto.refreshToken, this.meta(req));
    return ApiResponses.success(result, 'Token refreshed successfully');
  }

  @Public()
  @Post('logout')
  @RateLimit(30)
  @ApiOperation({ summary: 'Revoke a refresh token (ends that session)' })
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
    return ApiResponses.success(null, 'Logged out successfully');
  }

  @Auth()
  @ApiBearerAuth()
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
