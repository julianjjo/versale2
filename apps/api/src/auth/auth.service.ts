import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { BCRYPT_SALT_ROUNDS } from '../common/bcrypt';
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

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const user = await this.prisma.client.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        // Stored hashed: a database leak alone must not hand out a live,
        // directly-usable verification token for every unverified account.
        verificationToken: hashOpaqueToken(verificationToken),
      },
    });

    return {
      ...this.generateToken(user),
      // No email provider is wired up yet. Outside this explicit opt-in the
      // token never leaves the server, so a misconfigured non-production
      // deployment can't leak it just because some other env var wasn't set
      // to exactly "production".
      ...(process.env.AUTH_EXPOSE_VERIFICATION_TOKEN === 'true'
        ? { verificationToken }
        : {}),
    };
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
    const resetToken = crypto.randomBytes(32).toString('hex');

    // A single conditional write instead of a read-then-write: `updateMany`
    // runs the same query whether or not the email is registered (it just
    // matches zero rows when it isn't), so a caller can't distinguish the
    // two cases by response timing either — only by the identical body
    // below, which never varies.
    const { count } = await this.prisma.client.user.updateMany({
      where: { email },
      data: {
        // Stored hashed: a database leak alone (backup exposure, a stray
        // read replica, a different bug) must not hand out live,
        // directly-usable reset tokens. The raw token — the only form that
        // hashes back to this value — is what actually goes out to the
        // caller below.
        resetToken: hashOpaqueToken(resetToken),
        resetTokenExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    // No email provider is wired up yet. This must default to OFF (fail
    // closed): inferring it from `NODE_ENV !== 'production'` would hand a
    // live, full-account-takeover reset token to anyone who submits an email
    // on any environment that isn't precisely `NODE_ENV=production` — a
    // staging box with `NODE_ENV` unset or left as `development` included.
    // Requiring an explicit opt-in means a misconfigured deploy stays safe.
    const exposeResetToken = process.env.AUTH_EXPOSE_RESET_TOKEN === 'true';

    return {
      message: FORGOT_PASSWORD_MESSAGE,
      ...(exposeResetToken && count > 0 ? { resetToken } : {}),
    };
  }

  async resetPassword(token: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Validating the token and invalidating it happen in one atomic query:
    // two concurrent submissions of the same token can't both pass a
    // separate check-then-act and both write a password, and there is no
    // window between "confirmed valid" and "consumed" for a second request
    // to slip through.
    const { count } = await this.prisma.client.user.updateMany({
      where: {
        resetToken: hashOpaqueToken(token),
        resetTokenExpires: { gt: new Date() },
      },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    if (count === 0) {
      throw new BadRequestException(
        'El enlace para restablecer la contraseña no es válido o expiró',
      );
    }

    return { message: 'Tu contraseña se actualizó correctamente' };
  }

  async verifyEmail(token: string) {
    // A single conditional update instead of a read-then-write: an unknown
    // or already-consumed token (verificationToken is cleared on success, so
    // replaying it matches nothing) both resolve through the same `count`
    // check below, with no separate existence read to race against.
    const { count } = await this.prisma.client.user.updateMany({
      where: { verificationToken: hashOpaqueToken(token) },
      data: { isVerified: true, verificationToken: null },
    });

    if (count === 0) {
      throw new BadRequestException(
        'El enlace de verificación no es válido o ya fue usado',
      );
    }

    return { message: 'Tu correo se verificó correctamente' };
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

// Shared by both the password-reset and email-verification tokens: both are
// opaque, single-use secrets that must be looked up by exact match, and
// each already carries 256 bits of entropy from crypto.randomBytes, so this
// only needs to defeat "the plaintext DB value is directly usable" — not
// resist offline guessing the way a password hash does. Deterministic
// (unlike bcrypt) on purpose, since the lookup is by exact match.
function hashOpaqueToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
