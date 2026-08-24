import { PaymentsController } from '../payments.controller';

describe('PaymentsController throttle', () => {
  it('throttles MercadoPago webhook to 20 req/min', () => {
    const ttl = Reflect.getMetadata(
      'THROTTLER:TTLdefault',
      PaymentsController.prototype.webhook,
    );
    const limit = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      PaymentsController.prototype.webhook,
    );
    expect(ttl).toBe(60000);
    expect(limit).toBe(20);
  });
});
