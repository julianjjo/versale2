import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthRequest } from '../types/request.types';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private favoritesService: FavoritesService) {}

  @Get()
  async getFavorites(@Req() req: AuthRequest, @Query() query: any) {
    return this.favoritesService.findAll(req.user.id, query);
  }

  // A literal one-segment path, so it can never collide with the bare
  // @Get() above or the :productId routes below regardless of declaration
  // order.
  @Get('ids')
  async getFavoriteIds(@Req() req: AuthRequest) {
    return this.favoritesService.findAllIds(req.user.id);
  }

  @Post(':productId')
  async addFavorite(
    @Req() req: AuthRequest,
    @Param('productId') productId: string,
  ) {
    return this.favoritesService.addFavorite(req.user.id, productId);
  }

  @Delete(':productId')
  async removeFavorite(
    @Req() req: AuthRequest,
    @Param('productId') productId: string,
  ) {
    return this.favoritesService.removeFavorite(req.user.id, productId);
  }
}
