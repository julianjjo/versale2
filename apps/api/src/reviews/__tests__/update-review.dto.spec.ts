import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateReviewDto } from '../dto/update-review.dto';

describe('UpdateReviewDto field constraints', () => {
  it('rejects a rating below the minimum', async () => {
    const dto = plainToInstance(UpdateReviewDto, { rating: 0 });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'rating')).toBe(true);
  });

  it('rejects a rating above the maximum', async () => {
    const dto = plainToInstance(UpdateReviewDto, { rating: 6 });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'rating')).toBe(true);
  });

  it('rejects a non-integer rating', async () => {
    const dto = plainToInstance(UpdateReviewDto, { rating: 3.5 });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'rating')).toBe(true);
  });

  it('accepts a valid rating', async () => {
    const dto = plainToInstance(UpdateReviewDto, { rating: 4 });

    const errors = await validate(dto);

    expect(errors).toEqual([]);
  });
});

describe('UpdateReviewDto validation with explicit null vs omitted (undefined) rating', () => {
  it('rejects an explicit null rating instead of letting it reach Prisma', async () => {
    const dto = plainToInstance(UpdateReviewDto, { rating: null });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'rating')).toBe(true);
  });

  it('allows an omitted (undefined) rating with no validation errors', async () => {
    const dto = plainToInstance(UpdateReviewDto, {});

    const errors = await validate(dto);

    expect(errors).toEqual([]);
  });

  it('still allows an explicit null comment, which is genuinely nullable', async () => {
    const dto = plainToInstance(UpdateReviewDto, { comment: null });

    const errors = await validate(dto);

    expect(errors).toEqual([]);
  });
});
