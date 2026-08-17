import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ReportCategory } from '@prisma/client';
import { CreateReportDto } from '../create-report.dto';

describe('CreateReportDto with the global ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = {
    type: 'body' as const,
    metatype: CreateReportDto,
  };

  it('accepts a valid report', async () => {
    const result = await pipe.transform(
      {
        productId: 'product1',
        reason: 'Parece una estafa',
        category: ReportCategory.FRAUD,
      },
      metadata,
    );

    expect(result).toEqual({
      productId: 'product1',
      reason: 'Parece una estafa',
      category: ReportCategory.FRAUD,
    });
  });

  it('rejects a missing productId', async () => {
    await expect(
      pipe.transform(
        { reason: 'Motivo', category: ReportCategory.OTHER },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a missing category', async () => {
    await expect(
      pipe.transform(
        { productId: 'product1', reason: 'Motivo' },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a category that is not one of the known values', async () => {
    await expect(
      pipe.transform(
        { productId: 'product1', reason: 'Motivo', category: 'NOT_REAL' },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an empty reason', async () => {
    await expect(
      pipe.transform(
        {
          productId: 'product1',
          reason: '',
          category: ReportCategory.OTHER,
        },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a whitespace-only reason', async () => {
    await expect(
      pipe.transform(
        {
          productId: 'product1',
          reason: '   ',
          category: ReportCategory.OTHER,
        },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('trims the reason before validating and storing it', async () => {
    const result = await pipe.transform(
      {
        productId: 'product1',
        reason: '  Parece una estafa  ',
        category: ReportCategory.OTHER,
      },
      metadata,
    );

    expect(result.reason).toBe('Parece una estafa');
  });

  it('rejects a reason longer than 500 characters', async () => {
    await expect(
      pipe.transform(
        {
          productId: 'product1',
          reason: 'a'.repeat(501),
          category: ReportCategory.OTHER,
        },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('strips unexpected fields so a report can never forge reporterId', async () => {
    const result = await pipe.transform(
      {
        productId: 'product1',
        reason: 'Parece una estafa',
        category: ReportCategory.OTHER,
        reporterId: 'someone-else',
      },
      metadata,
    );

    expect(result).toEqual({
      productId: 'product1',
      reason: 'Parece una estafa',
      category: ReportCategory.OTHER,
    });
    expect((result as Record<string, unknown>).reporterId).toBeUndefined();
  });
});
