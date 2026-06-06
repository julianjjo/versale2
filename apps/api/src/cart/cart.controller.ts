import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getCart(@Request() req) {
    const userId = req.user.userId;
    return this.cartService.getCart(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('items')
  async addItem(@Request() req, @Body() body: { productId: string; quantity: number }) {
    const userId = req.user.userId;
    return this.cartService.addItem(userId, body.productId, body.quantity);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('items/:itemId')
  async updateItem(@Request() req, @Param('itemId') itemId: string, @Body() body: { quantity: number }) {
    const userId = req.user.userId;
    return this.cartService.updateItem(itemId, body.quantity, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('items/:itemId')
  async removeItem(@Request() req, @Param('itemId') itemId: string) {
    const userId = req.user.userId;
    return this.cartService.removeItem(itemId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  async clearCart(@Request() req) {
    const userId = req.user.userId;
    return this.cartService.clearCart(userId);
  }
}
