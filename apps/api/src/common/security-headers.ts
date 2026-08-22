import { NestExpressApplication } from '@nestjs/platform-express';

// Cheap, dependency-free stand-ins for the handful of `helmet()` headers that
// matter for a JSON API fronting a SPA: no inline scripts to restrict via
// CSP, but the Swagger UI (the one HTML page this API ever serves, see
// resolveSwaggerEnabled below) is worth denying to iframes, and MIME-sniffing
// protection is free on every response either way.
export function applySecurityHeaders(app: NestExpressApplication): void {
  app.use(
    (
      _req: unknown,
      res: { setHeader: (name: string, value: string) => void },
      next: () => void,
    ) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      next();
    },
  );
}

// Fail-closed: Swagger only ever comes up on an explicit opt-in, never by
// inferring "non-production" from NODE_ENV. An unset or misspelled
// NODE_ENV (anything other than exactly "production") used to publish the
// entire API surface — every admin route, every DTO shape — with no auth.
export function resolveSwaggerEnabled(): boolean {
  return process.env.ENABLE_SWAGGER === 'true';
}
