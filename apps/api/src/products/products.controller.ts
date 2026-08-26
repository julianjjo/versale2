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
  Header,
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
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

const toLimit = (v: string | undefined, f: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 1_000_000 ? n : f;
};
export const PRODUCTS_SEARCH_THROTTLE_TTL = minutes(1);
export const PRODUCTS_SEARCH_THROTTLE_LIMIT = toLimit(
  process.env.PRODUCTS_SEARCH_THROTTLE_LIMIT,
  60,
);

// Shared caches only. The catalog changes the moment an admin approves,
// rejects or pauses a listing, and the previous
// `max-age=30, stale-while-revalidate=60` let a browser answer from its own
// copy for half a minute — and then keep answering from it, stale, for a
// further minute while it revalidated in the background. Someone who had just
// looked at the catalog kept seeing it without the listing that had since
// been approved. `s-maxage` leaves the 30s window where the load this header
// exists to absorb actually lands, and a browser revalidation is a 304, not a
// repeated query. `stale-while-revalidate` is gone rather than shortened:
// there is no shared-cache-only spelling of it.
const CATALOG_CACHE_CONTROL = 'public, max-age=0, s-maxage=30';

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
  @Header('Cache-Control', CATALOG_CACHE_CONTROL)
  async findAll(@Query() query: any) {
    return this.productsService.findAll(query);
  }

  @Get('facets')
  @Header('Cache-Control', CATALOG_CACHE_CONTROL)
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

  @Throttle({
    default: {
      ttl: PRODUCTS_SEARCH_THROTTLE_TTL,
      limit: PRODUCTS_SEARCH_THROTTLE_LIMIT,
    },
  })
  @Get('suggested-price')
  @Header('Cache-Control', CATALOG_CACHE_CONTROL)
  async getSuggestedPrice(
    @Query('category') category: string,
    @Query('condition') condition: string,
  ) {
    if (!category || !condition) return { suggestedPrice: null };
    return this.productsService.getSuggestedPrice(category, condition);
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
      req.user.role,
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
      req.user.role,
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
      req.user.role,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.productsService.remove(id, req.user.id, req.user.role);
  }

  // Two segments (':id/pause', ':id/unpause'), so neither collides with the
  // bare ':id' routes above regardless of declaration order — same reasoning
  // as 'sellers/:id' and ':id/related'.
  @UseGuards(JwtAuthGuard)
  @Patch(':id/pause')
  async pause(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.productsService.pauseProduct(id, req.user.id, req.user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/unpause')
  async unpause(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.productsService.unpauseProduct(id, req.user.id, req.user.role);
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
