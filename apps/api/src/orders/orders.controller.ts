import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Header,
  NotFoundException,
} from '@nestjs/common';
import { AuthRequest } from '../types/request.types';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { ShipSaleDto } from './dto/ship-sale.dto';
import { CreateDisputeDto } from './dto/dispute.dto';

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
  async getUserOrders(@Req() req: AuthRequest, @Query() query: unknown) {
    const userId = req.user.id;
    return this.ordersService.getUserOrders(userId, query);
  }

  @Get(':id')
  async getOrderById(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user.id;
    return this.ordersService.getOrderById(id, userId, req.user.role);
  }

  // A buyer's own self-service cancellation, distinct from the admin
  // `admin/:id/status` route below: it can only ever move an order to
  // CANCELLED, and only the order's own owner may call it.
  @Patch(':id/cancel')
  async cancelOrder(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.ordersService.cancelOwnOrder(req.user.id, id);
  }

  // A seller's own fulfillment queue and self-service "mark as shipped",
  // distinct from the admin routes below: `mine/sales*` only ever touches
  // orders that include the caller's own products (see OrdersService for the
  // mixed-seller-order guard). Two/three-segment paths, same reasoning as
  // `admin/*` below, so they never collide with the single-segment `:id`.
  @Get('mine/sales')
  async getMySales(@Req() req: AuthRequest, @Query() query: unknown) {
    return this.ordersService.getMySales(req.user.id, query);
  }

  @Patch('mine/sales/:id/ship')
  async shipOwnSale(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: ShipSaleDto,
  ) {
    return this.ordersService.shipOwnSale(req.user.id, id, body.trackingNumber);
  }

  // Admin routes live under the two-segment `admin/*` prefix, so the
  // single-segment `@Get(':id')` above cannot capture them. Keep them grouped
  // here and keep the `admin/` prefix: a one-segment literal would have to be
  // declared before `:id` to win, since Nest matches in declaration order.
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/stats')
  async getOrderStats() {
    return this.ordersService.getOrderStats();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/all')
  async getAllOrders(@Query() query: unknown) {
    return this.ordersService.getAllOrders(query);
  }

  // Two segments (`admin/export`), same shape as `admin/all` and `admin/stats`
  // above — never collides with the three-segment `admin/:id/status` below.
  // `@Header` (not a manual `@Res()` write) lets Nest still handle the
  // response body while adding the two headers a file download needs.
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="pedidos.csv"')
  async exportOrders(@Query() query: unknown) {
    return this.ordersService.exportOrdersCsv(query);
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

  // debug sweeps only in test; no exponer en prod, no añadir auth bypass
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/debug/run-sweeps')
  async runSweepsDebug() {
    if (process.env.NODE_ENV !== 'test') {
      throw new NotFoundException();
    }
    await this.ordersService.runOrderDeadlineSweeps();
    return { ok: true };
  }

  // Item 12: una sola disputa por orden, 48h desde la entrega, fotos
  // obligatorias — las reglas viven en OrdersService.openDispute.
  @Post(':id/dispute')
  async openDispute(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: CreateDisputeDto,
  ) {
    return this.ordersService.openDispute(req.user.id, id, body);
  }
}
