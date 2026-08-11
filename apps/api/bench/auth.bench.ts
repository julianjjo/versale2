import { bench, describe } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from '../src/auth/roles.guard';
import { ROLES_KEY } from '../src/auth/roles.decorator';
import { Role } from '../src/users/role.enum';

// Token signing/verification runs on every authenticated request, and the
// roles guard runs on every admin route, so both are on the hot path.
const jwtService = new JwtService({
  secret: 'bench-secret-not-used-in-production',
  signOptions: { expiresIn: '7d' },
});

const payload = {
  sub: 'ckv8x2z1a0000',
  email: 'ana@example.com',
  role: Role.USER,
};
const token = jwtService.sign(payload);

describe('JwtService', () => {
  bench('sign an access token', () => {
    jwtService.sign(payload);
  });

  bench('verify an access token', () => {
    jwtService.verify(token);
  });

  bench('decode without verifying', () => {
    jwtService.decode(token);
  });
});

class AdminHandler {}
function adminHandler() {}
Reflect.defineMetadata(ROLES_KEY, [Role.ADMIN], adminHandler);

function makeContext(user: { role: Role } | null): ExecutionContext {
  return {
    getHandler: () => adminHandler,
    getClass: () => AdminHandler,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const guard = new RolesGuard(new Reflector());
const adminContext = makeContext({ role: Role.ADMIN });
const userContext = makeContext({ role: Role.USER });
const anonymousContext = makeContext(null);

describe('RolesGuard', () => {
  bench('admin allowed on an admin route', () => {
    guard.canActivate(adminContext);
  });

  bench('user rejected on an admin route', () => {
    guard.canActivate(userContext);
  });

  bench('anonymous rejected on an admin route', () => {
    guard.canActivate(anonymousContext);
  });
});
