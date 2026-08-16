import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ProductsService } from '../products/products.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ProductsService],
})
export class ReportsModule {}
