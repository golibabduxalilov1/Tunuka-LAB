import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard, AuthUser, User } from './auth.guard';

type Creds = { email?: string; password?: string };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() b: Creds) {
    return this.auth.login(b?.email, b?.password);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@User() u: AuthUser) {
    return u;
  }
}
