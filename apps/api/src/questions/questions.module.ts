import { Module } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';
import { ProductsService } from '../products/products.service';

@Module({
  controllers: [QuestionsController],
  providers: [QuestionsService, ProductsService],
})
export class QuestionsModule {}
