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
} from '@nestjs/common';
import { AuthRequest } from '../types/request.types';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post()
  async create(@Req() req: AuthRequest, @Body() body: CreateReportDto) {
    return this.reportsService.create(
      req.user.id,
      body.productId,
      body.reason,
      body.category,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/all')
  async getAll(@Query() query: any) {
    return this.reportsService.getAll(query);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/dismiss')
  async dismiss(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.reportsService.dismiss(id, req.user.id);
  }
}
