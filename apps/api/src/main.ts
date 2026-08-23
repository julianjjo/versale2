import { resolve } from 'path';

try {
  process.loadEnvFile(resolve(__dirname, '..', '.env'));
} catch {
  // .env optional — production uses real env vars
}

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  applySecurityHeaders,
  resolveSwaggerEnabled,
} from './common/security-headers';

// Local dev (3000) and the Playwright harness (3100) are allowed out of the
// box. Any other deployment must set CORS_ORIGIN (comma-separated list).
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3100',
  'http://127.0.0.1:3100',
];

function resolveCorsOrigins(): string[] {
  const configured = process.env.CORS_ORIGIN ?? process.env.WEB_ORIGIN;
  if (!configured) {
    return DEFAULT_CORS_ORIGINS;
  }
  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  // A value that is only separators or whitespace would leave an empty list,
  // and `enableCors({ origin: [] })` rejects every browser origin with no
  // diagnostic — a one-character typo would take the web app down.
  return origins.length > 0 ? origins : DEFAULT_CORS_ORIGINS;
}

// How many reverse proxies sit in front of the API. The global ThrottlerGuard
// buckets by `req.ip`; without this Express reports the proxy's address for
// every request, so one shared bucket throttles the whole user base at once
// while an attacker rotating source IPs is never counted. Trusting a proxy
// hop is opt-in: an unset or invalid value must fail closed to `false`,
// otherwise a direct-access deployment would accept a client-supplied
// `X-Forwarded-For` as `req.ip` and let an attacker bypass IP throttling.
// Set TRUST_PROXY_HOPS to the real hop count once the API sits behind a
// trusted reverse proxy.
function resolveTrustProxy(): number | boolean {
  const configured = process.env.TRUST_PROXY_HOPS;
  if (configured === undefined) return false;
  if (configured === 'false') return false;

  const hops = Number(configured);
  return Number.isInteger(hops) && hops >= 0 ? hops : false;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', resolveTrustProxy());
  applySecurityHeaders(app);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  });

  if (resolveSwaggerEnabled()) {
    const config = new DocumentBuilder()
      .setTitle('Versale API')
      .setDescription('API for the Versale used clothing marketplace')
      .setVersion('1.0')
      .addTag('auth')
      .addTag('users')
      .addTag('products')
      .addTag('cart')
      .addTag('orders')
      .addTag('reviews')
      .addTag('admin')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  await app.listen(process.env.PORT || 3001);
}
bootstrap();
