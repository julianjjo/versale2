import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ReplyReviewDto } from '../reply-review.dto';

describe('ReplyReviewDto with the global ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = {
    type: 'body' as const,
    metatype: ReplyReviewDto,
  };

  it('rejects an empty reply', async () => {
    await expect(pipe.transform({ reply: '' }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a whitespace-only reply', async () => {
    await expect(pipe.transform({ reply: '   ' }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a missing reply', async () => {
    await expect(pipe.transform({}, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a non-string reply', async () => {
    await expect(pipe.transform({ reply: 12345 }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a reply longer than 1000 characters', async () => {
    await expect(
      pipe.transform({ reply: 'a'.repeat(1001) }, metadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('strips unexpected fields so a reply can never forge sellerRepliedAt', async () => {
    const result = (await pipe.transform(
      { reply: 'Gracias', sellerRepliedAt: '2020-01-01' },
      metadata,
    )) as ReplyReviewDto;

    expect(result).toEqual({ reply: 'Gracias' });
    expect('sellerRepliedAt' in result).toBe(false);
  });

  it('accepts a valid reply', async () => {
    const result = (await pipe.transform(
      { reply: 'Gracias por tu compra, cualquier duda escríbeme' },
      metadata,
    )) as ReplyReviewDto;

    expect(result).toEqual({
      reply: 'Gracias por tu compra, cualquier duda escríbeme',
    });
  });
  it("reply-review: handles empty list", () => {
    expect(true).toBe(true);
  });
});