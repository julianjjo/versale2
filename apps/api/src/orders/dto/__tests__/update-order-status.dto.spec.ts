import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateOrderStatusDto } from '../update-order-status.dto';
import { OrderStatus } from '../../order-status.enum';

describe('UpdateOrderStatusDto with the global ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = {
    type: 'body' as const,
    metatype: UpdateOrderStatusDto,
  };

  it('accepts a valid status', async () => {
    const result = (await pipe.transform(
      { status: OrderStatus.PAID },
      metadata,
    )) as UpdateOrderStatusDto;

    expect(result.status).toBe(OrderStatus.PAID);
  });

  it('rejects an invalid status', async () => {
    await expect(
      pipe.transform({ status: 'NOT_REAL' }, metadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a whitespace-only status', async () => {
    await expect(pipe.transform({ status: '   ' }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('trims the status before validating and storing it', async () => {
    const result = (await pipe.transform(
      { status: '  PAID  ' },
      metadata,
    )) as UpdateOrderStatusDto;

    expect(result.status).toBe(OrderStatus.PAID);
  });

  it('rejects a padded invalid status after trim', async () => {
    await expect(
      pipe.transform({ status: '  NOT_REAL  ' }, metadata),
    ).rejects.toThrow(BadRequestException);
  });
});
