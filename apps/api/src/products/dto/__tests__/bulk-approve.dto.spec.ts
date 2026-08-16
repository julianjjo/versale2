import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { BulkApproveDto } from '../bulk-approve.dto';

describe('BulkApproveDto with the global ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = {
    type: 'body' as const,
    metatype: BulkApproveDto,
  };

  it('accepts a list of string ids', async () => {
    const result = await pipe.transform(
      { ids: ['product1', 'product2'] },
      metadata,
    );

    expect(result).toEqual({ ids: ['product1', 'product2'] });
  });

  it('rejects a missing ids field', async () => {
    await expect(pipe.transform({}, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an empty ids array', async () => {
    await expect(pipe.transform({ ids: [] }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a non-array ids value', async () => {
    await expect(pipe.transform({ ids: 'product1' }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an array containing a non-string id', async () => {
    await expect(
      pipe.transform({ ids: ['product1', 42] }, metadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects more than 100 ids', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `product${i}`);

    await expect(pipe.transform({ ids }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('accepts exactly 100 ids', async () => {
    const ids = Array.from({ length: 100 }, (_, i) => `product${i}`);

    await expect(pipe.transform({ ids }, metadata)).resolves.toEqual({ ids });
  });
});
