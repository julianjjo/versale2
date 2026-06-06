import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AuthRequest } from '../types/request.types';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getCart(@Req() req: AuthRequest) {
    const userId = req.user.id;
    return this.cartService.getCart(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('items')
  async addItem(@Req() req: AuthRequest, @Body() body: { productId: string; quantity: number }) {
    const userId = req.user.id;
    return this.cartService.addItem(userId, body.productId, body.quantity);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('items/:itemId')
  async updateItem(@Req() req: AuthRequest, @Param('itemId') itemId: string, @Body() body: { quantity: number }) {
    const userId = req.user.id;
    return this.cartService.updateItem(itemId, body.quantity, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('items/:itemId')
  async removeItem(@Req() req: AuthRequest, @Param('itemId') itemId: string) {
    const userId = req.user.id;
    return this.cartService.removeItem(itemId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  async clearCart(@Req() req: AuthRequest) {
    const userId = req.user.id;
    return this.cartService.clearCart(userId);
  }
}
