import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthRequest } from '../types/request.types';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getProfile(@Req() req: AuthRequest) {
    const userId = req.user.id;
    return this.usersService.findOne(userId);
  }

  @Patch('me')
  async updateProfile(
    @Req() req: AuthRequest,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const userId = req.user.id;
    return this.usersService.update(userId, updateUserDto, {
      isSelfService: true,
    });
  }

  /**
   * Autoserborrado de cuenta. Declarado ANTES de @Delete(':id') para que la
   * ruta estática gane el despacho — si no, Nest encajaría "me" como :id del
   * endpoint admin y devolvería 403 a quien quiere borrarse.
   */
  @Delete('me')
  async deleteOwnAccount(
    @Req() req: AuthRequest,
    @Body() dto: DeleteAccountDto,
  ) {
    return this.usersService.deleteOwnAccount(req.user.id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  async findAll(@Query() query: Record<string, unknown>) {
    return this.usersService.findAll(query);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.usersService.remove(id, req.user.id);
  }
}
