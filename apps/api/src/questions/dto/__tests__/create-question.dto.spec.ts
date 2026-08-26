import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateQuestionDto } from '../create-question.dto';

describe('CreateQuestionDto with the global ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = {
    type: 'body' as const,
    metatype: CreateQuestionDto,
  };

  it('accepts a valid question', async () => {
    const result = (await pipe.transform(
      { productId: 'product1', question: '¿Es talla M o L?' },
      metadata,
    )) as CreateQuestionDto;

    expect(result).toEqual({
      productId: 'product1',
      question: '¿Es talla M o L?',
    });
  });

  it('rejects a missing productId', async () => {
    await expect(
      pipe.transform({ question: '¿Pregunta?' }, metadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an empty question', async () => {
    await expect(
      pipe.transform({ productId: 'product1', question: '' }, metadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a whitespace-only question', async () => {
    await expect(
      pipe.transform({ productId: 'product1', question: '   ' }, metadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('trims the question before validating and storing it', async () => {
    const result = (await pipe.transform(
      { productId: 'product1', question: '  ¿Es talla M?  ' },
      metadata,
    )) as CreateQuestionDto;

    expect(result.question).toBe('¿Es talla M?');
  });

  it('rejects a question longer than 500 characters', async () => {
    await expect(
      pipe.transform(
        { productId: 'product1', question: 'a'.repeat(501) },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('strips unexpected fields so a question can never forge askerId', async () => {
    const result = (await pipe.transform(
      {
        productId: 'product1',
        question: '¿Pregunta?',
        askerId: 'someone-else',
      },
      metadata,
    )) as CreateQuestionDto;

    expect(result).toEqual({ productId: 'product1', question: '¿Pregunta?' });
    expect('askerId' in result).toBe(false);
  });
});
