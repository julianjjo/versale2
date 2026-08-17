import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Delete,
  Query,
  Res,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthRequest } from '../types/request.types';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
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
  async createReview(
    @Req() req: AuthRequest,
    @Body() body: CreateReviewDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req.user.id;
    const { review, created } = await this.reviewsService.create(
      body,
      userId,
      body.productId,
    );

    // Posting again for the same product edits the existing review, so the
    // response is a 200 OK rather than a 201 Created.
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);

    return review;
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateReview(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: UpdateReviewDto,
  ) {
    const userId = req.user.id;
    return this.reviewsService.update(id, body, userId, req.user.role as Role);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/reply')
  async replyToReview(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: ReplyReviewDto,
  ) {
    return this.reviewsService.replyToReview(id, req.user.id, body.reply);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteReview(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user.id;
    return this.reviewsService.remove(id, userId, req.user.role as Role);
  }

  // Two segments (':id/helpful'), so it never collides with the bare ':id'
  // routes above regardless of declaration order — same reasoning as
  // ReviewsController's own ':id/reply'.
  @UseGuards(JwtAuthGuard)
  @Post(':id/helpful')
  async markHelpful(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.reviewsService.markHelpful(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/helpful')
  async unmarkHelpful(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.reviewsService.unmarkHelpful(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/all')
  async getAllReviews(@Query() query: any) {
    return this.reviewsService.getAllReviews(query);
  }
}
