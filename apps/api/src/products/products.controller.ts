import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Throttle, minutes } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthRequest } from '../types/request.types';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { RejectProductDto } from './dto/reject-product.dto';
import { BulkIdsDto } from './dto/bulk-ids.dto';
import { BulkRejectDto } from './dto/bulk-reject.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/role.enum';
import { parsePositiveIntEnv } from '../common/env';

// The public catalog needs no auth, so it's the one search surface anyone
// (including a script) can hit for free — and every call runs the same
// substring `contains` filter twice (findMany + count, see
// ProductsService#findAll), the most expensive query pattern in this API.
// Tighter than the global default so a search-scraping burst gets throttled
// well before it can degrade the catalog for everyone else, but loose enough
// that normal browsing/pagination/filter-clicking never comes close.
export const PRODUCTS_SEARCH_THROTTLE_TTL = minutes(1);
export const PRODUCTS_SEARCH_THROTTLE_LIMIT = parsePositiveIntEnv(
  process.env.PRODUCTS_SEARCH_THROTTLE_LIMIT,
  60,
);

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Throttle({
    default: {
      ttl: PRODUCTS_SEARCH_THROTTLE_TTL,
      limit: PRODUCTS_SEARCH_THROTTLE_LIMIT,
    },
  })
  @Get()
  async findAll(@Query() query: any) {
    return this.productsService.findAll(query);
  }

  @Get('facets')
  async getFacets() {
    return this.productsService.getFacets();
  }

  // A literal two-segment path, so it can never collide with the
  // single-segment ':id' below regardless of declaration order — a request
  // for '/products/sellers/abc' has two segments after '/products', which
  // ':id' alone can never match.
  @Get('sellers/:id')
  async getSellerProfile(@Param('id') id: string) {
    return this.productsService.getSellerProfile(id);
  }

  // Declared before ':id' so 'mine' is never swallowed by the id param route.
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  async findAllMine(@Query() query: any, @Req() req: AuthRequest) {
    return this.productsService.findAllMine(req.user.id, query);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    return this.productsService.findOne(
      id,
      (req as { user?: { id: string; role: Role } }).user ?? null,
    );
  }

  // Two segments (':id/related'), so it never collides with the bare ':id'
  // above regardless of declaration order — same reasoning as 'sellers/:id'.
  @Get(':id/related')
  async getRelatedProducts(@Param('id') id: string) {
    return this.productsService.getRelatedProducts(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() createProductDto: CreateProductDto,
    @Req() req: AuthRequest,
  ) {
    return this.productsService.create(createProductDto, req.user.id);
  }

  // Declared before ':id' below, same reasoning as 'mine' above: a
  // single-segment literal PATCH route has to come first or ':id' (also
  // PATCH, also one segment) would swallow 'bulk-pause'/'bulk-unpause' as if
  // they were product ids.
  @UseGuards(JwtAuthGuard)
  @Patch('bulk-pause')
  async bulkPauseProducts(
    @Body() bulkPauseDto: BulkIdsDto,
    @Req() req: AuthRequest,
  ) {
    return this.productsService.bulkPause(
      bulkPauseDto.ids,
      req.user.id,
      req.user.role as Role,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('bulk-unpause')
  async bulkUnpauseProducts(
    @Body() bulkUnpauseDto: BulkIdsDto,
    @Req() req: AuthRequest,
  ) {
    return this.productsService.bulkUnpause(
      bulkUnpauseDto.ids,
      req.user.id,
      req.user.role as Role,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Req() req: AuthRequest,
  ) {
    return this.productsService.update(
      id,
      updateProductDto,
      req.user.id,
      req.user.role as Role,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.productsService.remove(id, req.user.id, req.user.role as Role);
  }

  // Two segments (':id/pause', ':id/unpause'), so neither collides with the
  // bare ':id' routes above regardless of declaration order — same reasoning
  // as 'sellers/:id' and ':id/related'.
  @UseGuards(JwtAuthGuard)
  @Patch(':id/pause')
  async pause(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.productsService.pauseProduct(
      id,
      req.user.id,
      req.user.role as Role,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/unpause')
  async unpause(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.productsService.unpauseProduct(
      id,
      req.user.id,
      req.user.role as Role,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/all')
  async findAllForAdmin(@Query() query: any) {
    return this.productsService.findAllForAdmin(query);
  }

  // Declared as a literal two-segment path (admin/bulk-approve), so it never
  // collides with the three-segment admin/:id/approve below regardless of
  // declaration order.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/bulk-approve')
  async bulkApproveProducts(@Body() bulkApproveDto: BulkIdsDto) {
    return this.productsService.bulkApprove(bulkApproveDto.ids);
  }

  // Same two-segment reasoning as admin/bulk-approve above, relative to the
  // three-segment admin/:id/reject below.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/bulk-reject')
  async bulkRejectProducts(@Body() bulkRejectDto: BulkRejectDto) {
    return this.productsService.bulkReject(
      bulkRejectDto.ids,
      bulkRejectDto.reason,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/:id/approve')
  async approveProduct(@Param('id') id: string) {
    return this.productsService.approveProduct(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/:id/reject')
  async rejectProduct(
    @Param('id') id: string,
    @Body() rejectProductDto: RejectProductDto,
  ) {
    return this.productsService.rejectProduct(id, rejectProductDto.reason);
  }
}
