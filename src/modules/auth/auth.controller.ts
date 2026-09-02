import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../decorators/public.decorator';
import { Auth } from '../../decorators/auth.decorator';
import { CurrentUser } from '../../decorators/currentuser.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create a new account' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Log in with username/email + password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Auth()
  @Get('me')
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  me(@CurrentUser() user: unknown) {
    return user;
  }
}
