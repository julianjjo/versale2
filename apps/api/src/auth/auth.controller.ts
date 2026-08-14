import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle, minutes } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
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

// forgot-password has a different threat model than login/signup: it isn't
// guarding stolen-credential stuffing, it's guarding against inbox-bombing a
// victim with reset requests or using response timing/volume to probe which
// emails are registered. Each handler gets its own counter regardless (the
// throttler keys on class+handler+IP), so this only needs its own, tighter
// limit — not a separate decorator mechanism.
export const FORGOT_PASSWORD_THROTTLE_LIMIT = parsePositiveIntEnv(
  process.env.FORGOT_PASSWORD_THROTTLE_LIMIT,
  10,
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

  @Throttle({
    default: { ttl: AUTH_THROTTLE_TTL, limit: FORGOT_PASSWORD_THROTTLE_LIMIT },
  })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );
  }
}
