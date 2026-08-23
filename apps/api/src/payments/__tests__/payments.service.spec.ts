import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PaymentsService } from '../payments.service';
import { OrdersService } from '../../orders/orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus } from '../../orders/order-status.enum';

// Item 16: el webhook de MP debe ser idempotente por paymentId — MP reintenta
// notificaciones y duplicados no pueden procesar un pedido dos veces.

jest.mock('../../orders/orders.service');

const mockPrismaService = {
  client: {
    order: {
      findUnique: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    notification: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
};

const mockOrdersService = {
  updateOrderStatus: jest.fn(),
};

const mpApprovedResponse = () => ({
  ok: true,
  status: 200,
  json: () => ({
    id: 123456789,
    status: 'approved',
    transaction_amount: 80000,
    external_reference: 'order1',
  }),
});

const stubFetch = (response: unknown) => {
  global.fetch = jest.fn().mockResolvedValue(response);
};

describe('PaymentsService', () => {
  let service: PaymentsService;
  const originalToken = process.env.MP_ACCESS_TOKEN;

  beforeEach(async () => {
    process.env.MP_ACCESS_TOKEN = 'test-mp-token';
    stubFetch(mpApprovedResponse());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OrdersService, useValue: mockOrdersService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.MP_ACCESS_TOKEN;
    } else {
      process.env.MP_ACCESS_TOKEN = originalToken;
    }
    jest.clearAllMocks();
  });

  describe('createPreference', () => {
    it('rechaza sin credenciales de MercadoPago', async () => {
      delete process.env.MP_ACCESS_TOKEN;
      await expect(
        service.createPreference('buyer1', 'order1', {
          success: 'https://x.test/s',
          failure: 'https://x.test/f',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('rechaza pagar el pedido de otro comprador', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'otro',
        status: 'PENDING',
        totalAmount: 80000,
        items: [],
      });

      await expect(
        service.createPreference('buyer1', 'order1', {
          success: 'https://x.test/s',
          failure: 'https://x.test/f',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza preferencias para pedidos no pendientes', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'buyer1',
        status: OrderStatus.PAID,
        totalAmount: 80000,
        items: [],
      });

      await expect(
        service.createPreference('buyer1', 'order1', {
          success: 'https://x.test/s',
          failure: 'https://x.test/f',
        }),
      ).rejects.toThrow(/ya no está pendiente/);
    });
  });

  describe('processWebhookNotification — idempotencia por paymentId', () => {
    it('procesa la primera notificación approved y marca el pedido PAID', async () => {
      mockPrismaService.client.payment.findUnique.mockResolvedValue(null);
      mockPrismaService.client.payment.create.mockResolvedValue({});
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'buyer1',
        status: OrderStatus.PENDING,
        totalAmount: 80000,
      });
      mockOrdersService.updateOrderStatus.mockResolvedValue({});

      const result = await service.processWebhookNotification('123456789');

      expect(result).toEqual({ processed: true, duplicate: false });
      expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith(
        'order1',
        OrderStatus.PAID,
      );
      expect(mockPrismaService.client.payment.create).toHaveBeenCalledTimes(1);
      // Captura tipada de la fila escrita: el mock sin tipos deja
      // expect.objectContaining como `any` y el linter lo rechaza.
      const createMock = mockPrismaService.client.payment.create as unknown as {
        mock: {
          calls: Array<
            [{ data: { paymentId: string; orderId: string; status: unknown } }]
          >;
        };
      };
      expect(createMock.mock.calls[0][0].data).toEqual(
        expect.objectContaining({
          paymentId: '123456789',
          orderId: 'order1',
          status: 'approved',
        }),
      );
    });

    it('ignora como duplicado el reintento del mismo paymentId (idempotencia)', async () => {
      // Segunda llegada del mismo pago: ya existe en la tabla Payment.
      mockPrismaService.client.payment.findUnique.mockResolvedValue({
        id: 'payment-row-1',
      });

      const result = await service.processWebhookNotification('123456789');

      expect(result).toEqual({ processed: false, duplicate: true });
      // El pedido NO se reprocesa ni se inserta otra fila.
      expect(mockOrdersService.updateOrderStatus).not.toHaveBeenCalled();
      expect(mockPrismaService.client.payment.create).not.toHaveBeenCalled();
    });

    it('trata como duplicado el choque concurrente por índice único', async () => {
      mockPrismaService.client.payment.findUnique.mockResolvedValue(null);
      // La carrera la gana otro webhook: el create viola el índice único
      // (P2002, la firma exacta de "otro webhook procesó este pago").
      const p2002 = new Error('Unique constraint failed') as Error & {
        code?: string;
      };
      p2002.code = 'P2002';
      mockPrismaService.client.payment.create.mockRejectedValue(p2002);
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'buyer1',
        status: OrderStatus.PENDING,
        totalAmount: 80000,
      });

      const result = await service.processWebhookNotification('123456789');

      expect(result).toEqual({ processed: false, duplicate: true });
      expect(mockOrdersService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('relanza los errores de BD que no son la carrera del índice único', async () => {
      mockPrismaService.client.payment.findUnique.mockResolvedValue(null);
      // Un fallo cualquiera (conexión, disco…) NO debe enmascararse como
      // duplicado: el webhook debe responder 5xx para que MP reintente.
      mockPrismaService.client.payment.create.mockRejectedValue(
        new Error('Connection refused'),
      );
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'buyer1',
        status: OrderStatus.PENDING,
        totalAmount: 80000,
      });

      await expect(
        service.processWebhookNotification('123456789'),
      ).rejects.toThrow('Connection refused');
      expect(mockOrdersService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('no revienta si la orden dejó de estar PENDING entre el read y la transición', async () => {
      mockPrismaService.client.payment.findUnique.mockResolvedValue(null);
      mockPrismaService.client.payment.create.mockResolvedValue({});
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'buyer1',
        status: OrderStatus.PENDING,
        totalAmount: 80000,
      });
      // Otra ruta (admin, otro pago) movió la orden justo después del read:
      // el CAS del camino canónico falla con 400.
      mockOrdersService.updateOrderStatus.mockRejectedValue(
        new BadRequestException('No se puede cambiar el estado del pedido'),
      );

      const result = await service.processWebhookNotification('123456789');

      expect(result).toEqual({ processed: false, duplicate: false });
    });

    it('no marca PAID un pago approved por menos del total del pedido', async () => {
      stubFetch({
        ok: true,
        status: 200,
        json: () => ({
          id: 111222333,
          status: 'approved',
          transaction_amount: 1,
          external_reference: 'order1',
        }),
      });
      mockPrismaService.client.payment.findUnique.mockResolvedValue(null);
      mockPrismaService.client.payment.create.mockResolvedValue({});
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'buyer1',
        status: OrderStatus.PENDING,
        totalAmount: 80000,
      });

      const result = await service.processWebhookNotification('111222333');

      // Se audita el pago (fila creada) pero la orden sigue PENDING.
      expect(result).toEqual({ processed: false, duplicate: false });
      expect(mockPrismaService.client.payment.create).toHaveBeenCalled();
      expect(mockOrdersService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('no mueve estados para pagos no aprobados', async () => {
      stubFetch({
        ok: true,
        status: 200,
        json: () => ({
          id: 987654321,
          status: 'rejected',
          transaction_amount: 80000,
          external_reference: 'order1',
        }),
      });
      mockPrismaService.client.payment.findUnique.mockResolvedValue(null);

      const result = await service.processWebhookNotification('987654321');

      expect(result).toEqual({ processed: false, duplicate: false });
      expect(mockOrdersService.updateOrderStatus).not.toHaveBeenCalled();
      expect(mockPrismaService.client.payment.create).not.toHaveBeenCalled();
    });

    it('rechaza notificaciones sin data.id', async () => {
      await expect(service.processWebhookNotification('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('verifica el pago contra la API de MP, no contra el body', async () => {
      mockPrismaService.client.payment.findUnique.mockResolvedValue(null);
      mockPrismaService.client.payment.create.mockResolvedValue({});
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'buyer1',
        status: OrderStatus.PENDING,
        totalAmount: 80000,
      });
      mockOrdersService.updateOrderStatus.mockResolvedValue({});
      const fetchMock = global.fetch as unknown as jest.MockedFunction<
        typeof fetch
      >;
      fetchMock.mockClear();
      await service.processWebhookNotification('123456789');

      // El único fetch es GET /v1/payments/{id} — el body nunca se confía.
      expect(fetchMock.mock.calls).toHaveLength(1);
      expect(fetchMock.mock.calls[0][0]).toContain('/v1/payments/123456789');
    });
  });
});
