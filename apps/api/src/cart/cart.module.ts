import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { ProductsService } from '../products/products.service';

@Module({
  controllers: [CartController],
  providers: [CartService, ProductsService],
  exports: [CartService],
})
export class CartModule {}
