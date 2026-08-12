import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateReviewDto } from '../update-review.dto';

// PATCH /reviews/:id used to be typed as Partial<CreateReviewDto>. A mapped type
// erases to Object at runtime, so the global pipe skipped validation AND
// whitelisting for that route entirely. These cases lock the real DTO class in.
describe('UpdateReviewDto with the global ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = {
    type: 'body' as const,
    metatype: UpdateReviewDto,
  };

  it('rejects a rating outside the 1-5 range', async () => {
    await expect(pipe.transform({ rating: 9999 }, metadata)).rejects.toThrow(
      BadRequestException,
    );
    await expect(pipe.transform({ rating: 0 }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a non-integer rating', async () => {
    await expect(pipe.transform({ rating: 4.5 }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('strips productId so a review can never be reassigned to another product', async () => {
    const result = await pipe.transform(
      { rating: 5, productId: 'someoneElsesProduct' },
      metadata,
    );

    expect(result).toBeInstanceOf(UpdateReviewDto);
    expect(result).toEqual({ rating: 5 });
    expect((result as Record<string, unknown>).productId).toBeUndefined();
  });

  it('strips userId so a review can never be forged under another identity', async () => {
    const result = await pipe.transform(
      { comment: 'Actualizado', userId: 'anotherUser' },
      metadata,
    );

    expect(result).toEqual({ comment: 'Actualizado' });
    expect((result as Record<string, unknown>).userId).toBeUndefined();
  });

  it('accepts the two editable fields', async () => {
    const result = await pipe.transform(
      { rating: 3, comment: 'Buen estado, talla justa' },
      metadata,
    );

    expect(result).toEqual({ rating: 3, comment: 'Buen estado, talla justa' });
  });

  it('accepts an empty patch', async () => {
    const result = await pipe.transform({}, metadata);

    expect(result).toEqual({});
  });
});
