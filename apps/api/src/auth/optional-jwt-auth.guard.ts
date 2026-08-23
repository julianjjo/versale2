import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard, resolveBearerUser } from './jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthRequest } from '../types/request.types';

// Same contract as before: a valid token attaches `request.user`, and any
// failure (no header, bad signature, unknown user) leaves it unset instead
// of rejecting — the endpoint decides what an anonymous caller sees.
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  constructor(jwtService: JwtService, prisma: PrismaService) {
    super(jwtService, prisma);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const [jwtService, prisma] = this.requireDeps();
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = await resolveBearerUser(jwtService, prisma, request);
    if (user) {
      request.user = user;
    }
    return true;
  }
}
