import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, minutes } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { UploadsModule } from './uploads/uploads.module';
import { ReviewsModule } from './reviews/reviews.module';
import { FavoritesModule } from './favorites/favorites.module';
import { ReportsModule } from './reports/reports.module';
import { QuestionsModule } from './questions/questions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BrevoModule } from './notifications/brevo.module';
import { PrismaModule } from './prisma/prisma.module';
import { parsePositiveIntEnv } from './common/env';

// Rate limits are tracked per IP and per endpoint. The default ceiling is
// generous enough for normal browsing and the automated suites; the auth
// endpoints opt into a much stricter limit (see AuthController).
// Overridable via THROTTLE_LIMIT so a test run can raise it from a single IP.
export const DEFAULT_THROTTLE_TTL = minutes(1);
export const DEFAULT_THROTTLE_LIMIT = parsePositiveIntEnv(
  process.env.THROTTLE_LIMIT,
  300,
);

@Module({
  imports: [
    ScheduleModule.forRoot(),
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
    PaymentsModule,
    UploadsModule,
    ReviewsModule,
    FavoritesModule,
    ReportsModule,
    QuestionsModule,
    NotificationsModule,
    BrevoModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
