import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { BrevoService } from './brevo.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, BrevoService],
  exports: [NotificationsService, BrevoService],
})
export class NotificationsModule {}
