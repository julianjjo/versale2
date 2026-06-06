import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';

@Module({
  controllers: [CartController],
  providers: [CartService, PrismaService, ProductsService],
})
export class CartModule {}
