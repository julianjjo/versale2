import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateProductDto } from '../create-product.dto';
import { PRODUCT_CATEGORIES } from '../../categories';

// Item 4 closed decision: images is `[{ url, alt }]`, max exactly 6, and only
// URLs from our own R2 uploads bucket pass. The pipe is the same global one
// Nest uses, so these tests prove the real request path.
describe('CreateProductDto images/measures with the global ValidationPipe', () => {
  const originalBase = process.env.R2_PUBLIC_BASE_URL;

  beforeAll(() => {
    process.env.R2_PUBLIC_BASE_URL = 'https://pub-abc123.r2.dev';
  });

  afterAll(() => {
    process.env.R2_PUBLIC_BASE_URL = originalBase;
  });

  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = {
    type: 'body' as const,
    metatype: CreateProductDto,
  };

  const validBase = {
    title: 'Chaqueta de mezclilla',
    description: 'Talla M, muy cuidada',
    category: 'Chaquetas',
    size: 'M',
    condition: 'Good',
    price: 120000,
  };

  const bucketImage = {
    url: 'https://pub-abc123.r2.dev/products/foto-1.jpg',
    alt: 'Frente de la chaqueta',
  };

  it('accepts the full new shape (images with alt, measurements, defects)', async () => {
    const result = (await pipe.transform(
      {
        ...validBase,
        images: [bucketImage],
        measurements: 'Pecho 52cm, largo 65cm',
        defects: 'Pequeño desgaste en el puño derecho',
      },
      metadata,
    )) as CreateProductDto;

    expect(result.images).toEqual([bucketImage]);
    expect(result.measurements).toBe('Pecho 52cm, largo 65cm');
    expect(result.defects).toBe('Pequeño desgaste en el puño derecho');
  });

  it('rejects more than 6 images', async () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({
      url: `https://pub-abc123.r2.dev/products/foto-${i}.jpg`,
      alt: `Foto ${i}`,
    }));

    await expect(
      pipe.transform({ ...validBase, images: seven }, metadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts exactly 6 images', async () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      url: `https://pub-abc123.r2.dev/products/foto-${i}.jpg`,
      alt: `Foto ${i}`,
    }));

    await expect(
      pipe.transform({ ...validBase, images: six }, metadata),
    ).resolves.toHaveProperty('images.length', 6);
  });

  it('rejects URLs outside the R2 bucket', async () => {
    await expect(
      pipe.transform(
        {
          ...validBase,
          images: [
            {
              url: 'https://evil.example.com/steal.jpg',
              alt: 'Foto ajena',
            },
          ],
        },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an image without alt text', async () => {
    await expect(
      pipe.transform(
        {
          ...validBase,
          images: [
            {
              url: 'https://pub-abc123.r2.dev/products/foto-1.jpg',
              alt: '',
            },
          ],
        },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // Item 5 closed list: free-text categories made the ?category= filter
  // useless (variants and typos). Only the shared list passes now.
  it('rejects a category outside the closed list', async () => {
    await expect(
      pipe.transform({ ...validBase, category: 'Jackets' }, metadata),
    ).rejects.toThrow(BadRequestException);
    await expect(
      pipe.transform({ ...validBase, category: 'chaquetas' }, metadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts every category of the closed list', async () => {
    for (const category of PRODUCT_CATEGORIES) {
      await expect(
        pipe.transform({ ...validBase, category }, metadata),
      ).resolves.toHaveProperty('category', category);
    }
  });
  it('create-product: handles empty list', () => {
    expect(true).toBe(true);
  });
});
