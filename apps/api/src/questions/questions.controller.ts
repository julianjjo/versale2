import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthRequest } from '../types/request.types';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { AnswerQuestionDto } from './dto/answer-question.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('questions')
export class QuestionsController {
  constructor(private questionsService: QuestionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req: AuthRequest, @Body() body: CreateQuestionDto) {
    return this.questionsService.create(
      req.user.id,
      body.productId,
      body.question,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/all')
  async getAllForAdmin(@Query() query: Record<string, unknown>) {
    return this.questionsService.getAllForAdmin(query);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/answer')
  async answer(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: AnswerQuestionDto,
  ) {
    return this.questionsService.answer(id, req.user.id, body.answer);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.questionsService.remove(id, req.user.id, req.user.role as Role);
  }
}
