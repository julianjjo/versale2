import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthRequest } from '../types/request.types';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
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
  async createReview(@Req() req: AuthRequest, @Body() body: CreateReviewDto) {
    const userId = req.user.id;
    return this.reviewsService.create(body, userId, body.productId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateReview(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: Partial<CreateReviewDto>,
  ) {
    const userId = req.user.id;
    return this.reviewsService.update(id, body, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteReview(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user.id;
    return this.reviewsService.remove(id, userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/all')
  async getAllReviews(@Query() query: any) {
    return this.reviewsService.getAllReviews(query);
  }
}
