import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ShipSaleDto } from '../ship-sale.dto';

describe('ShipSaleDto with the global ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = {
    type: 'body' as const,
    metatype: ShipSaleDto,
  };

  it('accepts an empty body — the tracking number is optional', async () => {
    const result = await pipe.transform({}, metadata);
    expect(result).toEqual({});
  });

  it('accepts a valid tracking number', async () => {
    const result = await pipe.transform({ trackingNumber: 'ABC123' }, metadata);
    expect(result).toEqual({ trackingNumber: 'ABC123' });
  });

  it('rejects a non-string tracking number', async () => {
    await expect(
      pipe.transform({ trackingNumber: 12345 }, metadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a tracking number longer than 100 characters', async () => {
    await expect(
      pipe.transform({ trackingNumber: 'a'.repeat(101) }, metadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('strips unexpected fields', async () => {
    const result = await pipe.transform(
      { trackingNumber: 'ABC123', status: 'DELIVERED' },
      metadata,
    );
    expect(result).toEqual({ trackingNumber: 'ABC123' });
    expect((result as Record<string, unknown>).status).toBeUndefined();
  });
});
