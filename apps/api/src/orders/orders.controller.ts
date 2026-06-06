import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AuthRequest } from '../types/request.types';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/role.enum';
import { OrderStatus } from '../users/role.enum';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createOrder(@Req() req: AuthRequest) {
    const userId = req.user.id;
    return this.ordersService.createOrder(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserOrders(@Req() req: AuthRequest) {
    const userId = req.user.id;
    return this.ordersService.getUserOrders(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getOrderById(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user.id;
    return this.ordersService.getOrderById(id, userId);
  }

  // Admin routes
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  async getAllOrders() {
    return this.ordersService.getAllOrders();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/status')
  async updateOrderStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.ordersService.updateOrderStatus(id, body.status as OrderStatus);
  }
}
