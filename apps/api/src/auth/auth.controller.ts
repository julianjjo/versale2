import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { Throttle, minutes } from '@nestjs/throttler';
import { AuthRequest } from '../types/request.types';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { PrismaService } from '../prisma/prisma.service';

const toLimit = (v: string | undefined, f: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 1_000_000 ? n : f;
};
export const AUTH_THROTTLE_TTL = minutes(1);
export const AUTH_THROTTLE_LIMIT = toLimit(process.env.AUTH_THROTTLE_LIMIT, 30);
export const FORGOT_PASSWORD_THROTTLE_LIMIT = toLimit(
  process.env.FORGOT_PASSWORD_THROTTLE_LIMIT,
  10,
);

@Throttle({
  default: { ttl: AUTH_THROTTLE_TTL, limit: AUTH_THROTTLE_LIMIT },
})
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

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

  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto.token);
  }

  // Item 17: reenvío del correo de verificación para la cuenta propia. El
  // throttle de clase cubre el abuso (cada IP tiene su presupuesto por
  // minuto); un usuario autenticado re-mandando su propio correo es benigno.
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  async resendVerification(@Req() req: AuthRequest) {
    return this.authService.resendVerification(req.user.id);
  }

  // debug backdate only in test; no exponer en prod, no añadir auth bypass
  @HttpCode(HttpStatus.OK)
  @Post('debug/backdate')
  async debugBackdate(
    @Body()
    body: {
      email?: string;
      verificationTokenExpires?: string | null;
      resetTokenExpires?: string | null;
    },
  ) {
    if (process.env.NODE_ENV !== 'test') {
      throw new NotFoundException();
    }
    const email = body.email?.trim();
    if (!email) {
      throw new NotFoundException('email required');
    }
    const data: Record<string, unknown> = {};
    if (body.verificationTokenExpires !== undefined) {
      data.verificationTokenExpires = body.verificationTokenExpires
        ? new Date(body.verificationTokenExpires)
        : null;
    }
    if (body.resetTokenExpires !== undefined) {
      data.resetTokenExpires = body.resetTokenExpires
        ? new Date(body.resetTokenExpires)
        : null;
    }
    if (Object.keys(data).length === 0) {
      throw new NotFoundException('no field to backdate');
    }
    await this.prisma.client.user.update({
      where: { email },
      data,
    });
    return { ok: true };
  }
}
