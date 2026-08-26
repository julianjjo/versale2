import { Module } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';
import { ProductsService } from '../products/products.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  controllers: [QuestionsController],
  providers: [QuestionsService, ProductsService],
  imports: [NotificationsModule],
})
export class QuestionsModule {}
