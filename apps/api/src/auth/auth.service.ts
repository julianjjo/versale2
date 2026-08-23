import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { BCRYPT_SALT_ROUNDS } from '../common/bcrypt';
import { BrevoService } from '../notifications/brevo.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from '@prisma/client';

// Generic response returned whether or not the email is registered — this
// endpoint must never let a caller distinguish the two, or it becomes an
// account-enumeration oracle.
const FORGOT_PASSWORD_MESSAGE =
  'Si el correo existe, enviaremos instrucciones para restablecer la contraseña';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
// Item 17: el token de verificación también caduca — 24 h es la ventana
// habitual para que un enlace de confirmación siga siendo usable sin quedar
// vivo indefinidamente.
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// Base de los enlaces que llegan por correo (verify-email / reset-password).
function webAppUrl(): string {
  return process.env.WEB_APP_URL ?? 'http://localhost:3000';
}

// Not a real account's hash — bcrypt.hash('versale-timing-safety-dummy', 10),
// generated once and hardcoded. login() below compares against this when the
// email isn't registered, purely so that branch spends the same ~tens-of-ms
// of bcrypt work as the "wrong password" branch. Its cost factor must track
// BCRYPT_SALT_ROUNDS: bcrypt.compare()'s runtime depends on the cost factor
// embedded in the hash being compared against, not on anything about the
// caller's input, so the two branches only stay comparable if this hash was
// produced at the same cost every real user's password hash uses.
export const TIMING_SAFE_DUMMY_HASH =
  '$2b$10$H/BlKyoyPzxsME37eNXFdea6VNbzmOqBEr515gyGZiwqjf11EBS32';

export type AuthenticatedUser = Omit<User, 'password'>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private brevo: BrevoService,
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
        verificationTokenExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
        // Item 8: SignupDto's @Equals(true) on acceptedTerms already refused
        // this call ever reaching here without consent — this timestamp is
        // simply the record of when that happened, not another check.
        termsAcceptedAt: new Date(),
      },
    });

    await this.sendVerificationEmail(user.email, user.name, verificationToken);

    return {
      ...this.generateToken(user),
      // Outside the explicit dev/e2e opt-in the token never leaves the server,
      // so a misconfigured non-production deployment can't leak it just
      // because some other env var wasn't set to exactly "production".
      ...(process.env.AUTH_EXPOSE_VERIFICATION_TOKEN === 'true'
        ? { verificationToken }
        : {}),
    };
  }

  /**
   * Item 17: envío real del correo de verificación vía Brevo. Un fallo del
   * proveedor NO rompe el signup — la cuenta ya existe y el usuario puede
   * pedir otro correo con resend-verification; bloquear el alta por un
   * tercero caído sería peor.
   */
  private async sendVerificationEmail(
    email: string,
    name: string,
    rawToken: string,
  ): Promise<void> {
    const url = `${webAppUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`;
    try {
      await this.brevo.sendEmail({
        to: [{ email, name }],
        subject: 'Verifica tu correo en Versale',
        text: `Hola${name ? ` ${name}` : ''}: confirma tu correo con este enlace (vence en 24 horas): ${url}`,
        html: `<p>Hola${name ? ` ${name}` : ''}:</p><p>Confirma tu correo con <a href="${url}">este enlace</a>. Vence en 24 horas.</p>`,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el correo de verificación a ${email}: ${error}`,
      );
    }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.client.user.findUnique({ where: { email } });

    // Both branches must do comparable work before rejecting: without the
    // dummy compare() here, "no such account" returns after a single indexed
    // SELECT while "wrong password" additionally pays bcrypt's cost-10
    // compare — a difference reliable enough to enumerate registered emails
    // by response latency alone, the exact oracle forgotPassword() above is
    // already deliberately hardened against.
    const isPasswordValid = await bcrypt.compare(
      password,
      user?.password ?? TIMING_SAFE_DUMMY_HASH,
    );

    if (!user || !isPasswordValid) {
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

    // Item 17: el token sale por correo (Brevo) hacia el enlace de
    // /reset-password del frontend. Igual que en signup, un fallo del
    // proveedor no cambia la respuesta — que no varía exista o no el correo.
    if (count > 0) {
      const url = `${webAppUrl()}/reset-password?token=${encodeURIComponent(resetToken)}`;
      try {
        await this.brevo.sendEmail({
          to: [{ email }],
          subject: 'Restablece tu contraseña en Versale',
          text: `Para restablecer tu contraseña usa este enlace (vence en 1 hora): ${url}`,
          html: `<p>Para restablecer tu contraseña usa <a href="${url}">este enlace</a>. Vence en 1 hora.</p><p>Si no fuiste tú, ignora este mensaje.</p>`,
        });
      } catch (error) {
        this.logger.error(
          `No se pudo enviar el correo de restablecimiento a ${email}: ${error}`,
        );
      }
    }

    // This must default to OFF (fail
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
        // Bumping this invalidates every JWT issued before the reset —
        // otherwise a token stolen before the owner "secures" their account
        // here would keep working indefinitely.
        tokenVersion: { increment: 1 },
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
    // A single conditional update instead of a read-then-write: an unknown,
    // already-consumed token (verificationToken is cleared on success, so
    // replaying it matches nothing) and an EXPIRED token (item 17) all
    // resolve through the same `count` check below, with no separate
    // existence read to race against.
    const { count } = await this.prisma.client.user.updateMany({
      where: {
        verificationToken: hashOpaqueToken(token),
        verificationTokenExpires: { gt: new Date() },
      },
      data: {
        isVerified: true,
        verificationToken: null,
        verificationTokenExpires: null,
      },
    });

    if (count === 0) {
      throw new BadRequestException(
        'El enlace de verificación no es válido o ya fue usado',
      );
    }

    return { message: 'Tu correo se verificó correctamente' };
  }

  /**
   * Item 17: re-emite el token de verificación de la cuenta propia. Sin este
   * camino, un correo de verificación perdido (o un cambio de dirección, que
   * anula el token anterior) deja la cuenta sin verificar para siempre.
   */
  async resendVerification(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, isVerified: true },
    });
    if (!user) {
      throw new BadRequestException('No se encontró la cuenta');
    }
    if (user.isVerified) {
      throw new BadRequestException('Tu correo ya está verificado');
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    await this.prisma.client.user.update({
      where: { id: user.id },
      data: {
        verificationToken: hashOpaqueToken(verificationToken),
        verificationTokenExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
      },
    });

    await this.sendVerificationEmail(user.email, user.name, verificationToken);

    return { message: 'Te enviamos un nuevo enlace de verificación' };
  }

  private generateToken(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };
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

    // Same reasoning as login() above: both branches must pay bcrypt's cost
    // before rejecting, or "no such account" vs "wrong password" becomes an
    // email-enumeration oracle by response timing alone. This method has no
    // caller wired up today, but it exists for the day a Passport
    // LocalStrategy calls it directly — better to close this before that
    // happens than depend on whoever wires it up remembering to.
    const isPasswordValid = await bcrypt.compare(
      password,
      user?.password ?? TIMING_SAFE_DUMMY_HASH,
    );

    if (!user || !isPasswordValid) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
