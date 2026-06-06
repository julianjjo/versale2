import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/role.enum';

@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Get('product/:productId')
  async getReviewsByProduct(@Param('productId') productId: string) {
    return this.reviewsService.findAllByProduct(productId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createReview(@Request() req, @Body() body: { productId: string; rating: number; comment?: string }) {
    const userId = req.user.userId;
    return this.reviewsService.create(body, userId, body.productId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateReview(@Request() req, @Param('id') id: string, @Body() body: { rating?: number; comment?: string }) {
    const userId = req.user.userId;
    return this.reviewsService.update(id, body, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteReview(@Request() req, @Param('id') id: string) {
    const userId = req.user.userId;
    return this.reviewsService.remove(id, userId);
  }

  // Admin routes
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  async getAllReviews(@Query() query: any) {
    return this.reviewsService.getAllReviews(query);
  }
}
