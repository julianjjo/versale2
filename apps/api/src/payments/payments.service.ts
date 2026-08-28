import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { OrderStatus } from '../orders/order-status.enum';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';

// Item 16: pasarela MercadoPago en modo sandbox. El reembolso/cobro real
// llega con el Hito 3 completo; aquí la mecánica es: preferencia de checkout,
// webhook verificado contra la API de MP e idempotencia por paymentId.

const MP_API_BASE = 'https://api.mercadopago.com';

// Prisma P2002 = unique constraint violation del índice único paymentId:
// la firma exacta de "otro webhook ganó la carrera por este pago".
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

interface MpPaymentResponse {
  id: number;
  status: string;
  transaction_amount: number;
  external_reference?: string | null;
}

export interface PaymentPreference {
  preferenceId: string;
  initPoint: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
  ) {}

  private accessToken(): string | undefined {
    return process.env.MP_ACCESS_TOKEN || undefined;
  }

  /**
   * Crea la preferencia de checkout de MP para un pedido PENDING del
   * comprador. Devuelve el init_point al que redirigir al comprador.
   */
  async createPreference(
    userId: string,
    orderId: string,
    backUrls: { success: string; failure: string },
  ): Promise<PaymentPreference> {
    orderId = orderId.trim();
    if (!orderId) {
      throw new BadRequestException('orderId es obligatorio');
    }
    const token = this.accessToken();
    if (!token) {
      // Sin credenciales no hay pasarela: fallar claro, no simular un pago.
      throw new ServiceUnavailableException(
        'MercadoPago no está configurado (MP_ACCESS_TOKEN).',
      );
    }

    const order = await this.prisma.client.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
        totalAmount: true,
        items: { select: { productId: true, quantity: true, price: true } },
      },
    });

    if (!order) {
      throw new BadRequestException('No se encontró el pedido');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException(
        'No tienes autorización para pagar este pedido',
      );
    }
    // El status llega como enum generado de @prisma/client; la comparación
    // contra el enum local del repo (mismos valores) se alinea con un cast
    // para satisfacer no-unsafe-enum-comparison sin duplicar la fuente.
    if ((order.status as OrderStatus) !== OrderStatus.PENDING) {
      throw new BadRequestException('Este pedido ya no está pendiente de pago');
    }

    const payload = {
      items: order.items.map((item) => ({
        id: item.productId,
        quantity: item.quantity,
        unit_price: item.price,
        currency_id: 'COP',
      })),
      external_reference: order.id,
      back_urls: backUrls,
    };

    const res = await fetch(`${MP_API_BASE}/checkout/preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      this.logger.error(
        `MP preferences ${res.status}: ${await res.text().catch(() => '')}`,
      );
      throw new ServiceUnavailableException(
        'No pudimos crear la preferencia de pago. Intenta de nuevo.',
      );
    }
    const pref = (await res.json()) as {
      id: string;
      init_point?: string;
      sandbox_init_point?: string;
    };

    return {
      preferenceId: pref.id,
      initPoint: pref.sandbox_init_point ?? pref.init_point ?? '',
    };
  }

  /**
   * Webhook de MP. El body de la notificación NO se confía: se vuelve a
   * consultar el pago contra la API de MP con el data.id recibido.
   *
   * Idempotencia por paymentId: el registro único en la tabla Payment hace
   * que reintentos de MP o webhooks duplicados sean no-ops — el pedido se
   * marca PAID exactamente una vez.
   */
  async processWebhookNotification(dataId: string): Promise<{
    processed: boolean;
    duplicate: boolean;
  }> {
    if (!dataId) {
      throw new BadRequestException('Notificación sin data.id');
    }

    const token = this.accessToken();
    if (!token) {
      throw new ServiceUnavailableException(
        'MercadoPago no está configurado (MP_ACCESS_TOKEN).',
      );
    }

    const res = await fetch(`${MP_API_BASE}/v1/payments/${dataId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      this.logger.error(`MP payments/${dataId} → ${res.status}`);
      throw new ServiceUnavailableException(
        'No pudimos verificar el pago con MercadoPago.',
      );
    }
    const mpPayment = (await res.json()) as MpPaymentResponse;

    // Idempotencia primero: si este paymentId ya se procesó, es un reintento.
    const existing = await this.prisma.client.payment.findUnique({
      where: { paymentId: String(mpPayment.id) },
      select: { id: true },
    });
    if (existing) {
      return { processed: false, duplicate: true };
    }

    if (mpPayment.status !== 'approved') {
      // Solo los aprobados mueven estados; los rechazados/pendientes se
      // ignoran (MP puede notificar de nuevo si cambian).
      return { processed: false, duplicate: false };
    }

    const orderId = mpPayment.external_reference;
    if (!orderId) {
      throw new BadRequestException('El pago no tiene external_reference');
    }
    const order = await this.prisma.client.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, status: true, totalAmount: true },
    });
    if (!order) {
      throw new BadRequestException('El pago referencia un pedido inexistente');
    }

    // Registro del pago: el índice único garantiza que dos webhooks
    // concurrentes del mismo pago no puedan insertar dos filas. Se registra
    // SIEMPRE un pago approved — incluso uno rechazado por la guardia de
    // monto de abajo queda auditado.
    try {
      await this.prisma.client.payment.create({
        data: {
          paymentId: String(mpPayment.id),
          orderId,
          status: mpPayment.status,
          amount: mpPayment.transaction_amount,
          rawPayload: { ...mpPayment },
        },
      });
    } catch (error) {
      // Perdimos una carrera contra otro webhook del mismo pago: no-op.
      // SOLO la violación del índice único cuenta como duplicado — un fallo
      // de BD cualquiera no debe enmascararse (el webhook devolvería 200 y
      // MP dejaría de reintentar un pago que nunca se procesó).
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      this.logger.warn(`Webhook duplicado concurrente para pago ${dataId}`);
      return { processed: false, duplicate: true };
    }

    // Guardia de monto (tras el registro para dejar auditoría): un pago
    // approved por MENOS que el total (preferencia manipulada, pago parcial)
    // no paga el pedido. Float se compara en centavos para no rechazar por
    // redondeo binario.
    const paidCents = Math.round(mpPayment.transaction_amount * 100);
    const owedCents = Math.round(order.totalAmount * 100);
    if (paidCents < owedCents) {
      this.logger.error(
        `Pago ${dataId} por ${paidCents} centavos < total ${owedCents} del pedido ${orderId}: no se marca PAID`,
      );
      return { processed: false, duplicate: false };
    }

    // El pedido pasa a PAID por el camino canónico (CAS + paidAt stamp).
    if ((order.status as OrderStatus) === OrderStatus.PENDING) {
      try {
        await this.ordersService.updateOrderStatus(orderId, OrderStatus.PAID);
      } catch (error) {
        // Carrera perdida: otra ruta movió la orden entre nuestro read y el
        // CAS del update. El pago ya quedó registrado y auditado — no vale
        // la pena responderle 400 a MP y provocarle una retrollamada extra.
        this.logger.warn(
          `Pago ${dataId} aprobado pero la orden ${orderId} ya no estaba PENDING: ${String(error)}`,
        );
        return { processed: false, duplicate: false };
      }
      await this.prisma.client.notification
        .create({
          data: {
            userId: order.userId,
            type: NotificationType.ORDER_STATUS_CHANGED,
            message: '¡Pago confirmado! Tu pedido se está preparando.',
            orderId,
          },
        })
        .catch(() => undefined);
    }

    return { processed: true, duplicate: false };
  }
}
