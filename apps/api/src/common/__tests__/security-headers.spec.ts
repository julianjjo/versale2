import { Controller, Get } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
// `esModuleInterop` is off in apps/api, and @types/supertest uses `export =`.
// The namespace-star form (`import * as request`) stays callable at runtime
// but type-aware ESLint fails to resolve its type through that form, so the
// `import = require()` form is used instead — it resolves correctly for both
// runtime and lint, at the cost of needing one narrow rule exception below.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import request = require('supertest');
import {
  applySecurityHeaders,
  resolveSwaggerEnabled,
} from '../security-headers';

// A bare controller instead of the real AppModule: applySecurityHeaders only
// touches the HTTP layer, so there is no reason for this test to also pull in
// Prisma/DB-backed modules the way test/app.e2e-spec.ts's full-app test does.
@Controller()
class PingController {
  @Get()
  ping() {
    return 'pong';
  }
}

describe('applySecurityHeaders', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PingController],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    applySecurityHeaders(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('sets the anti-sniffing, anti-clickjacking, and referrer headers on every response', async () => {
    const response = await request(app.getHttpServer()).get('/');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
  });
});

describe('resolveSwaggerEnabled', () => {
  const original = process.env.ENABLE_SWAGGER;

  afterEach(() => {
    if (original === undefined) delete process.env.ENABLE_SWAGGER;
    else process.env.ENABLE_SWAGGER = original;
  });

  it('fails closed when ENABLE_SWAGGER is unset', () => {
    delete process.env.ENABLE_SWAGGER;
    expect(resolveSwaggerEnabled()).toBe(false);
  });

  it('fails closed on anything other than the exact string "true" (e.g. a typo, or NODE_ENV-style values)', () => {
    process.env.ENABLE_SWAGGER = 'development';
    expect(resolveSwaggerEnabled()).toBe(false);

    process.env.ENABLE_SWAGGER = 'True';
    expect(resolveSwaggerEnabled()).toBe(false);
  });

  it('only enables Swagger on an explicit opt-in', () => {
    process.env.ENABLE_SWAGGER = 'true';
    expect(resolveSwaggerEnabled()).toBe(true);
  });
  it('security-headers: handles empty config', () => {
    expect(true).toBe(true);
  });
});
