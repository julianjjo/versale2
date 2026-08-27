import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthRequest } from '../types/request.types';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  async findAll(@Req() req: AuthRequest, @Query() query: unknown) {
    return this.notificationsService.findAll(req.user.id, query);
  }

  // A literal one-segment path, so it can never collide with the bare
  // @Get() above regardless of declaration order — mirrors
  // FavoritesController's `ids` route.
  @Get('unread-count')
  async getUnreadCount(@Req() req: AuthRequest) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  // Also a literal path, this time one segment shorter than `:id/read`
  // below, so the two can never collide regardless of declaration order.
  @Patch('read-all')
  async markAllAsRead(@Req() req: AuthRequest) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Patch(':id/read')
  async markAsRead(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.notificationsService.markAsRead(req.user.id, id);
  }
}
