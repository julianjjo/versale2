import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthRequest } from '../types/request.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { CreateMpPreferenceDto } from './dto/create-mp-preference.dto';

interface MpWebhookBody {
  data?: { id?: string | number };
}

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  // Item 16: preferencia de checkout para un pedido PENDING del comprador.
  // Devuelve el init_point de MP (sandbox en dev) al que redirigir.
  @UseGuards(JwtAuthGuard)
  @Post('mp/preference')
  async createPreference(
    @Req() req: AuthRequest,
    @Body() body: CreateMpPreferenceDto,
  ) {
    const fallback =
      process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    return this.paymentsService.createPreference(req.user.id, body.orderId, {
      success: body.backUrls?.success ?? `${fallback}/orders/${body.orderId}`,
      failure: body.backUrls?.failure ?? `${fallback}/cart`,
    });
  }

  /**
   * Webhook público de MercadoPago (sin guard: MP no manda JWT). La
   * verificación real ocurre consultando el pago contra la API de MP con el
   * data.id recibido; la idempotencia vive en el índice único paymentId.
   * En desarrollo, exponer vía ngrok (`ngrok http 3001`) y configurar la URL
   * `https://…ngrok.app/payments/webhooks/mp` en el panel de MP (sandbox).
   */
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Post('webhooks/mp')
  async webhook(@Body() body: MpWebhookBody) {
    // MP envía {type: 'payment', data: {id}}; el id es lo único que usamos —
    // el payload nunca se confía.
    const dataId = String(body?.data?.id ?? '');
    return this.paymentsService.processWebhookNotification(dataId);
  }
}
