import { PaymentsController } from '../payments.controller';

describe('PaymentsController throttle', () => {
  it('throttles MercadoPago webhook to 20 req/min', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const ttl = Reflect.getMetadata(
      'THROTTLER:TTLdefault',
      // eslint-disable-next-line @typescript-eslint/unbound-method
      PaymentsController.prototype.webhook,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const limit = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      // eslint-disable-next-line @typescript-eslint/unbound-method
      PaymentsController.prototype.webhook,
    );
    expect(ttl).toBe(60000);
    expect(limit).toBe(20);
  });
});
