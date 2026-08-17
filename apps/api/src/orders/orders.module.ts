import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { NotificationsService } from '../notifications/notifications.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, NotificationsService],
})
export class OrdersModule {}
