import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from '@prisma/client';

// Generic response returned whether or not the email is registered — this
// endpoint must never let a caller distinguish the two, or it becomes an
// account-enumeration oracle.
const FORGOT_PASSWORD_MESSAGE =
  'Si el correo existe, enviaremos instrucciones para restablecer la contraseña';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export type AuthenticatedUser = Omit<User, 'password'>;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signup(email: string, password: string, name: string) {
    const existingUser = await this.prisma.client.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Ya existe una cuenta con ese correo');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.prisma.client.user.create({
      data: { email, password: hashedPassword, name },
    });

    return this.generateToken(user);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.client.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.generateToken(user);
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.client.user.findUnique({ where: { email } });

    if (!user) {
      return { message: FORGOT_PASSWORD_MESSAGE };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    await this.prisma.client.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    return {
      message: FORGOT_PASSWORD_MESSAGE,
      // No email provider is wired up yet. Outside production the token is
      // handed back directly so the reset flow is usable and testable
      // end-to-end; in production this would be emailed instead.
      ...(process.env.NODE_ENV !== 'production' ? { resetToken } : {}),
    };
  }

  async resetPassword(token: string, password: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { resetToken: token },
    });

    if (
      !user ||
      !user.resetTokenExpires ||
      user.resetTokenExpires < new Date()
    ) {
      throw new BadRequestException(
        'El enlace para restablecer la contraseña no es válido o expiró',
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.prisma.client.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    return { message: 'Tu contraseña se actualizó correctamente' };
  }

  private generateToken(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.client.user.findUnique({ where: { email } });
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    const { password: _password, ...result } = user;
    return result;
  }
}
