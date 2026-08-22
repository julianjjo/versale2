import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateReviewDto } from '../create-review.dto';

describe('CreateReviewDto with the global ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = {
    type: 'body' as const,
    metatype: CreateReviewDto,
  };

  it('rejects a missing productId', async () => {
    await expect(pipe.transform({ rating: 5 }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a missing rating', async () => {
    await expect(
      pipe.transform({ productId: 'product-1' }, metadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a rating outside the 1-5 range', async () => {
    await expect(
      pipe.transform({ productId: 'product-1', rating: 0 }, metadata),
    ).rejects.toThrow(BadRequestException);
    await expect(
      pipe.transform({ productId: 'product-1', rating: 9999 }, metadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a non-integer rating', async () => {
    await expect(
      pipe.transform({ productId: 'product-1', rating: 4.5 }, metadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a review without a comment', async () => {
    const result = (await pipe.transform(
      { productId: 'product-1', rating: 4 },
      metadata,
    )) as CreateReviewDto;

    expect(result).toEqual({ productId: 'product-1', rating: 4 });
  });

  // Regression: IsOptional only skips validation for a missing/null/undefined
  // comment — an explicit "" or "   " used to sail through untouched and get
  // persisted as a blank review comment.
  it('rejects an empty comment', async () => {
    await expect(
      pipe.transform(
        { productId: 'product-1', rating: 4, comment: '' },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a whitespace-only comment', async () => {
    await expect(
      pipe.transform(
        { productId: 'product-1', rating: 4, comment: '   ' },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a comment longer than 1000 characters', async () => {
    await expect(
      pipe.transform(
        { productId: 'product-1', rating: 4, comment: 'a'.repeat(1001) },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a comment at exactly the 1000 character limit', async () => {
    const comment = 'a'.repeat(1000);
    const result = (await pipe.transform(
      { productId: 'product-1', rating: 4, comment },
      metadata,
    )) as CreateReviewDto;

    expect(result).toEqual({ productId: 'product-1', rating: 4, comment });
  });

  it('accepts a valid review with a comment', async () => {
    const result = (await pipe.transform(
      {
        productId: 'product-1',
        rating: 5,
        comment: 'Excelente estado, tal como en las fotos',
      },
      metadata,
    )) as CreateReviewDto;

    expect(result).toEqual({
      productId: 'product-1',
      rating: 5,
      comment: 'Excelente estado, tal como en las fotos',
    });
  });

  it('strips unexpected fields so a review can never forge userId', async () => {
    const result = (await pipe.transform(
      { productId: 'product-1', rating: 5, userId: 'anotherUser' },
      metadata,
    )) as CreateReviewDto;

    expect(result).toEqual({ productId: 'product-1', rating: 5 });
    expect(
      (result as unknown as Record<string, unknown>).userId,
    ).toBeUndefined();
  });
});
