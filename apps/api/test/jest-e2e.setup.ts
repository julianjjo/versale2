// Runs before each e2e test file is loaded (Jest `setupFiles`), i.e. before
// `AppModule` (and therefore `AuthModule`) is imported. `AuthModule` and
// `JwtStrategy` intentionally throw at module-load time when JWT_SECRET is
// unset (see F2: no insecure hardcoded fallback in application code), so
// e2e tests need a test-only secret provided here instead. Set it
// unconditionally so a real secret inherited from the shell environment
// (e.g. a staging/production value) is never used to sign e2e tokens.
process.env.JWT_SECRET = 'e2e-test-secret-do-not-use-in-production';
