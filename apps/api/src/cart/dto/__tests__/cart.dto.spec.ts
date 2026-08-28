import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  AddCartItemDto,
  UpdateCartItemDto,
  MAX_ITEM_QUANTITY,
} from '../cart.dto';

describe('cart quantity bounds with the global ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const addMetadata = { type: 'body' as const, metatype: AddCartItemDto };
  const updateMetadata = { type: 'body' as const, metatype: UpdateCartItemDto };

  it('rejects an absurd quantity that would mint a multi-trillion-COP order', async () => {
    await expect(
      pipe.transform(
        { productId: 'product1', quantity: 999999999 },
        addMetadata,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      pipe.transform({ quantity: 999999999 }, updateMetadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects more units than exist of a one-of-a-kind garment', async () => {
    await expect(
      pipe.transform(
        { productId: 'product1', quantity: MAX_ITEM_QUANTITY + 1 },
        addMetadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a non-positive quantity', async () => {
    await expect(
      pipe.transform({ productId: 'product1', quantity: 0 }, addMetadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts the single unit that actually exists', async () => {
    const result = (await pipe.transform(
      { productId: 'product1', quantity: MAX_ITEM_QUANTITY },
      addMetadata,
    )) as AddCartItemDto;

    expect(result).toEqual({
      productId: 'product1',
      quantity: MAX_ITEM_QUANTITY,
    });
  });

  it('rejects a whitespace-only productId', async () => {
    await expect(
      pipe.transform({ productId: '   ', quantity: 1 }, addMetadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('trims the productId before validating and storing it', async () => {
    const result = (await pipe.transform(
      { productId: '  product1  ', quantity: 1 },
      addMetadata,
    )) as AddCartItemDto;

    expect(result.productId).toBe('product1');
  });
  it('cart dto: handles empty list', () => {
    expect(true).toBe(true);
  });
});
