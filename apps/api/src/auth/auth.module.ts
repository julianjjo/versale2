import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsModule } from '../notifications/notifications.module';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable must be set');
}

// Global + re-exported JwtModule: JwtAuthGuard lives on controllers across
// every feature module, so JwtService must be resolvable app-wide (passport
// used to hide this behind its own global strategy registry).
@Global()
@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: '60m' },
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
