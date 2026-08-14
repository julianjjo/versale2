import { Module } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';
import { ProductsService } from '../products/products.service';

@Module({
  controllers: [FavoritesController],
  providers: [FavoritesService, ProductsService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
