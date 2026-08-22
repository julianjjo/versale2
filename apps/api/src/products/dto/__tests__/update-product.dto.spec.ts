import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateProductDto } from '../update-product.dto';

// UpdateProductDto used to be a hand-written clone of CreateProductDto with
// @IsNotEmpty swapped for @IsOptional. Dropping the emptiness checks meant
// PATCH /products/:id accepted `{"title": ""}` and blanked a live listing on
// every surface that renders it. It is now derived with PartialType, so each
// field keeps its own constraints and only becomes optional.
describe('UpdateProductDto with the global ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = {
    type: 'body' as const,
    metatype: UpdateProductDto,
  };

  it('rejects an empty title', async () => {
    await expect(pipe.transform({ title: '' }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an empty description and an empty category', async () => {
    await expect(pipe.transform({ description: '' }, metadata)).rejects.toThrow(
      BadRequestException,
    );
    await expect(pipe.transform({ category: '' }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('still enforces the inherited enum, length and price constraints', async () => {
    await expect(pipe.transform({ size: 'XXXL' }, metadata)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      pipe.transform({ condition: 'Destroyed' }, metadata),
    ).rejects.toThrow(BadRequestException);
    await expect(
      pipe.transform({ title: 'a'.repeat(121) }, metadata),
    ).rejects.toThrow(BadRequestException);
    await expect(pipe.transform({ price: 19990.5 }, metadata)).rejects.toThrow(
      BadRequestException,
    );
    await expect(pipe.transform({ price: 0 }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('accepts a partial patch of valid fields', async () => {
    const result = (await pipe.transform(
      { title: 'Chaqueta de mezclilla', price: 120000 },
      metadata,
    )) as Record<string, unknown>;

    expect(result).toEqual({
      title: 'Chaqueta de mezclilla',
      price: 120000,
    });
  });

  it('accepts an empty patch', async () => {
    await expect(pipe.transform({}, metadata)).resolves.toEqual({});
  });

  it('strips fields the seller must not be able to set', async () => {
    const result = (await pipe.transform(
      {
        title: 'Chaqueta',
        isApproved: true,
        status: 'AVAILABLE' as const,
        sellerId: 'otro',
      },
      metadata,
    )) as Record<string, unknown>;

    expect(result).toEqual({ title: 'Chaqueta' });
  });
});
