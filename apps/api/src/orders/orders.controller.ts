import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthRequest } from '../types/request.types';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/role.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  async createOrder(@Req() req: AuthRequest, @Body() body: CreateOrderDto) {
    const userId = req.user.id;
    return this.ordersService.createOrder(userId, body);
  }

  @Get()
  async getUserOrders(@Req() req: AuthRequest) {
    const userId = req.user.id;
    return this.ordersService.getUserOrders(userId);
  }

  @Get(':id')
  async getOrderById(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user.id;
    return this.ordersService.getOrderById(id, userId, req.user.role as Role);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/all')
  async getAllOrders() {
    return this.ordersService.getAllOrders();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/:id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateOrderStatus(id, body.status);
  }
}
