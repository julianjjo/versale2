import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle, minutes } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { parsePositiveIntEnv } from '../common/env';

// Credential-stuffing surface: both endpoints get a much stricter per-IP
// budget than the global default registered in AppModule. The throttler keys
// on the handler, so signup and login each get their own budget.
//
// Overridable via AUTH_THROTTLE_LIMIT because the automated suites log in once
// per test from a single IP and would otherwise trip the production ceiling.
export const AUTH_THROTTLE_TTL = minutes(1);
export const AUTH_THROTTLE_LIMIT = parsePositiveIntEnv(
  process.env.AUTH_THROTTLE_LIMIT,
  30,
);

@Throttle({
  default: { ttl: AUTH_THROTTLE_TTL, limit: AUTH_THROTTLE_LIMIT },
})
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(
      signupDto.email,
      signupDto.password,
      signupDto.name,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }
}
