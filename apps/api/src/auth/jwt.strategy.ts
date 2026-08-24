import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtFromRequestFunction } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

// Estructura mínima del JWT firmado por generateToken() y de la fila User
// que consume validate(). Tiparlos aquí evita propagar el `any` del payload
// y del cliente generado al resto del flujo.
interface JwtPayload {
  sub?: unknown;
  tokenVersion?: unknown;
}

interface ValidatedUserRow {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  tokenVersion: number;
  deletedAt: Date | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable must be set');
    }
    // passport-jwt's ExtractJwt namespace is typed as `any` in some
    // resolutions; keep a typed alias to satisfy no-unsafe-* rules without
    // resorting to `any` in the strategy options.
    const jwtFromRequest: JwtFromRequestFunction =
      ExtractJwt.fromAuthHeaderAsBearerToken();
    super({
      jwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    // Un sub ausente o no-string no puede matchear ningún uuid: cae en el
    // mismo 401 que un usuario inexistente.
    const userId = typeof payload.sub === 'string' ? payload.sub : '';
    const user = (await this.prisma.client.user.findUnique({
      where: { id: userId },
    })) as ValidatedUserRow | null;

    if (!user) {
      throw new UnauthorizedException('Token inválido');
    }

    // Cuenta eliminada: ni un JWT aún no expirado (p. ej. emitido desde otra
    // pestaña segundos antes del borrado) puede seguir operando. La vía
    // principal es el bump de tokenVersion del propio borrado; esto es la
    // segunda barrera si alguien copió el token y el payload viejo.
    if (user.deletedAt) {
      throw new UnauthorizedException('Token inválido');
    }

    // Tokens signed before this check existed carry no tokenVersion at all —
    // treat that as version 0 so they keep working until the first reset.
    // Once a password reset/change bumps the stored version, every token
    // still carrying the old (or missing) version is rejected, even if its
    // signature and expiry are otherwise valid.
    const tokenVersion =
      typeof payload.tokenVersion === 'number' ? payload.tokenVersion : 0;
    if (tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException('Token inválido');
    }

    // Return an object with the user's id (to match the expectation in controllers)
    return { id: user.id, email: user.email, role: user.role };
  }
}
