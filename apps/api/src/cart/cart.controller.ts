import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthRequest } from '../types/request.types';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private cartService: CartService) {}

  @Get()
  async getCart(@Req() req: AuthRequest) {
    return this.cartService.getCart(req.user.id);
  }

  @Post('items')
  async addItem(@Req() req: AuthRequest, @Body() body: AddCartItemDto) {
    return this.cartService.addItem(req.user.id, body.productId, body.quantity);
  }

  @Patch('items/:itemId')
  async updateItem(
    @Req() req: AuthRequest,
    @Param('itemId') itemId: string,
    @Body() body: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(itemId, body.quantity, req.user.id);
  }

  @Delete('items/:itemId')
  async removeItem(@Req() req: AuthRequest, @Param('itemId') itemId: string) {
    return this.cartService.removeItem(itemId, req.user.id);
  }

  @Delete()
  async clearCart(@Req() req: AuthRequest) {
    return this.cartService.clearCart(req.user.id);
  }
}
