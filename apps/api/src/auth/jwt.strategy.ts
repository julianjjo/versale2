import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable must be set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    const { sub: userId } = payload;
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Token inválido');
    }

    // Tokens signed before this check existed carry no tokenVersion at all —
    // treat that as version 0 so they keep working until the first reset.
    // Once a password reset/change bumps the stored version, every token
    // still carrying the old (or missing) version is rejected, even if its
    // signature and expiry are otherwise valid.
    const tokenVersion = payload.tokenVersion ?? 0;
    if (tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException('Token inválido');
    }

    // Return an object with the user's id (to match the expectation in controllers)
    return { id: user.id, email: user.email, role: user.role };
  }
}
