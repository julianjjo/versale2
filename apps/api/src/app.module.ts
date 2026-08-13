import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, minutes } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { UploadsModule } from './uploads/uploads.module';
import { ReviewsModule } from './reviews/reviews.module';
import { PrismaModule } from './prisma/prisma.module';

// Rate limits are tracked per IP and per endpoint. The default ceiling is
// generous enough for normal browsing and the automated suites; the auth
// endpoints opt into a much stricter limit (see AuthController).
// Overridable via THROTTLE_LIMIT so a test run can raise it from a single IP.
export const DEFAULT_THROTTLE_TTL = minutes(1);
// A non-positive, non-finite, or non-numeric env value falls back to the
// default instead of silently throttling every request to near-zero (or, for
// "Infinity", disabling the throttle entirely). `||` alone isn't enough here:
// a negative number is truthy in JS, so `Number('-1') || 300` would still
// evaluate to -1 — this requires the value to be finite and positive, not
// just truthy, before accepting it.
const parsedThrottleLimit = Number(process.env.THROTTLE_LIMIT);
export const DEFAULT_THROTTLE_LIMIT =
  Number.isFinite(parsedThrottleLimit) && parsedThrottleLimit > 0
    ? parsedThrottleLimit
    : 300;

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: DEFAULT_THROTTLE_TTL,
          limit: DEFAULT_THROTTLE_LIMIT,
        },
      ],
      errorMessage:
        'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    UploadsModule,
    ReviewsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
