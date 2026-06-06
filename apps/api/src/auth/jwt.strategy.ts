import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'defaultSecret',
    });
  }

  async validate(payload: any) {
    const { sub: userId } = payload;
    const user = await this.prisma.client.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    // Return an object with the user's id (to match the expectation in controllers)
    return { id: user.id, email: user.email, role: user.role };
  }
}
