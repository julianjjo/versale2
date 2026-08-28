import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateMpPreferenceDto } from '../create-mp-preference.dto';

describe('CreateMpPreferenceDto with the global ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = {
    type: 'body' as const,
    metatype: CreateMpPreferenceDto,
  };

  it('accepts a valid orderId', async () => {
    const result = (await pipe.transform(
      { orderId: 'order1' },
      metadata,
    )) as CreateMpPreferenceDto;

    expect(result.orderId).toBe('order1');
  });

  it('rejects a missing orderId', async () => {
    await expect(pipe.transform({}, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a whitespace-only orderId', async () => {
    await expect(pipe.transform({ orderId: '   ' }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('trims the orderId before validating and storing it', async () => {
    const result = (await pipe.transform(
      { orderId: '  order1  ' },
      metadata,
    )) as CreateMpPreferenceDto;

    expect(result.orderId).toBe('order1');
  });

  it('strips unexpected fields', async () => {
    const result = (await pipe.transform(
      { orderId: 'order1', extra: 'nope' },
      metadata,
    )) as CreateMpPreferenceDto;

    expect(
      (result as unknown as Record<string, unknown>).extra,
    ).toBeUndefined();
  });
});
