import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { MAX_ITEM_QUANTITY } from './dto/cart.dto';
import { Prisma, ProductStatus } from '@prisma/client';

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
  ) {}

  async getCart(userId: string) {
    return this.prisma.client.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: {
        items: {
          include: {
            product: {
              include: { seller: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
  }

  // addItem/updateItem/removeItem/clearCart all only ever need `cart.id` —
  // to build the upsert's compound key, or to compare against a cartItem's
  // own cartId for the ownership check. Only GET /cart (getCart above)
  // actually renders every item's full product+seller data, so routing
  // these through getCart's own deep include re-fetched every line item's
  // entire product row (images, description, measurements, defects) plus
  // seller info on every single add/update/remove, just to read one string.
  private async getOrCreateCartId(userId: string): Promise<string> {
    const cart = await this.prisma.client.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: { id: true },
    });
    return cart.id;
  }

  async addItem(userId: string, productId: string, quantity: number) {
    productId = productId.trim();
    this.assertValidQuantity(quantity);

    const cartId = await this.getOrCreateCartId(userId);

    const product = await this.productsService.findRaw(productId);
    if (!product.isApproved) {
      throw new BadRequestException(
        'El producto no está aprobado para la venta',
      );
    }

    if (product.status !== ProductStatus.AVAILABLE) {
      throw new BadRequestException(
        'Este producto ya fue vendido y no está disponible',
      );
    }
    if (product.pausedAt) {
      throw new BadRequestException(
        'El vendedor pausó este producto temporalmente y no está disponible',
      );
    }

    try {
      return await this.prisma.client.cartItem.upsert({
        where: { cartId_productId: { cartId, productId } },
        // Each listing is a single garment, so re-adding it keeps the line at the
        // same quantity instead of incrementing, and refreshes the price snapshot
        // so a later checkout can never be charged an outdated price.
        update: { quantity, priceAtAdd: product.price },
        create: {
          cartId,
          productId,
          quantity,
          priceAtAdd: product.price,
        },
        include: {
          product: {
            include: { seller: { select: { id: true, name: true } } },
          },
        },
      });
    } catch (e: unknown) {
      // ponytail: naive P2002-only idempotency; no per-key lock, safe because CartItem @@unique[cartId,productId] enforces it
      if (
        !(e instanceof Prisma.PrismaClientKnownRequestError) ||
        e.code !== 'P2002'
      )
        throw e;
      const existing = await this.prisma.client.cartItem.findUnique({
        where: { cartId_productId: { cartId, productId } },
        include: {
          product: {
            include: { seller: { select: { id: true, name: true } } },
          },
        },
      });
      if (!existing) throw e;
      return existing;
    }
  }

  async updateItem(cartItemId: string, quantity: number, userId: string) {
    cartItemId = cartItemId.trim();
    this.assertValidQuantity(quantity);

    const cartItem = await this.prisma.client.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: true },
    });

    if (!cartItem) {
      throw new NotFoundException(
        `No se encontró el producto del carrito con ID ${cartItemId}`,
      );
    }

    const cartId = await this.getOrCreateCartId(userId);
    if (cartItem.cartId !== cartId) {
      throw new ForbiddenException(
        'No tienes autorización para actualizar este producto del carrito',
      );
    }

    const product = await this.productsService.findRaw(cartItem.productId);
    if (!product.isApproved) {
      throw new BadRequestException(
        'El producto no está aprobado para la venta',
      );
    }
    if (product.status !== ProductStatus.AVAILABLE) {
      throw new BadRequestException(
        'Este producto ya fue vendido y no está disponible',
      );
    }
    if (product.pausedAt) {
      throw new BadRequestException(
        'El vendedor pausó este producto temporalmente y no está disponible',
      );
    }

    return this.prisma.client.cartItem.update({
      where: { id: cartItemId },
      data: { quantity, priceAtAdd: product.price },
      include: {
        product: {
          include: { seller: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async removeItem(cartItemId: string, userId: string) {
    cartItemId = cartItemId.trim();
    const cartItem = await this.prisma.client.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: true },
    });

    if (!cartItem) {
      throw new NotFoundException(
        `No se encontró el producto del carrito con ID ${cartItemId}`,
      );
    }

    const cartId = await this.getOrCreateCartId(userId);
    if (cartItem.cartId !== cartId) {
      throw new ForbiddenException(
        'No tienes autorización para eliminar este producto del carrito',
      );
    }

    return this.prisma.client.cartItem.delete({ where: { id: cartItemId } });
  }

  async clearCart(userId: string) {
    const cartId = await this.getOrCreateCartId(userId);
    await this.prisma.client.cartItem.deleteMany({
      where: { cartId },
    });
    return { success: true };
  }

  private assertValidQuantity(quantity: number) {
    if (
      !Number.isFinite(quantity) ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw new BadRequestException(
        'La cantidad debe ser un número entero positivo',
      );
    }

    if (quantity > MAX_ITEM_QUANTITY) {
      throw new BadRequestException(
        `Cada prenda es única: no puedes agregar más de ${MAX_ITEM_QUANTITY} unidad por producto`,
      );
    }
  }
}
