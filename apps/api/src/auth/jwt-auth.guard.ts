import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthRequest } from '../types/request.types';

export interface ResolvedUser {
  id: string;
  email: string;
  role: Role;
}

// Same job the old passport-jwt strategy did, minus the Passport layer:
// verify the Bearer token, load its user, and reject anything signed before
// the latest password reset (tokenVersion). Returns null instead of throwing
// so the optional variant can swallow failures.
export async function resolveBearerUser(
  jwtService: JwtService,
  prisma: PrismaService,
  request: { headers: { authorization?: string | string[] } },
): Promise<ResolvedUser | null> {
  const header = request.headers.authorization;
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw?.startsWith('Bearer ')) return null;

  let payload: { sub?: string; tokenVersion?: number };
  try {
    payload = await jwtService.verifyAsync(raw.slice('Bearer '.length));
  } catch {
    return null;
  }

  const user = await prisma.client.user.findUnique({
    where: { id: payload.sub ?? '' },
  });
  if (!user || (payload.tokenVersion ?? 0) !== user.tokenVersion) return null;

  return { id: user.id, email: user.email, role: user.role };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  // Optional so plain controller unit-test modules (which register neither
  // JwtModule nor PrismaModule) can still instantiate their controllers, the
  // same way passport's zero-dependency AuthGuard did. A guard asked to
  // actually authenticate without its deps must fail loudly, never open.
  constructor(
    @Optional() protected readonly jwtService?: JwtService,
    @Optional() protected readonly prisma?: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const [jwtService, prisma] = this.requireDeps();
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = await resolveBearerUser(jwtService, prisma, request);
    if (!user) {
      throw new UnauthorizedException('Token inválido');
    }
    request.user = user;
    return true;
  }

  protected requireDeps(): [JwtService, PrismaService] {
    if (!this.jwtService || !this.prisma) {
      throw new Error(
        'JwtAuthGuard is missing JwtService/PrismaService — wire AuthModule before guarding routes',
      );
    }
    return [this.jwtService, this.prisma];
  }
}
