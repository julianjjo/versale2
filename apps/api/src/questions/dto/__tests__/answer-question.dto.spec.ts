import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AnswerQuestionDto } from '../answer-question.dto';

describe('AnswerQuestionDto with the global ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = {
    type: 'body' as const,
    metatype: AnswerQuestionDto,
  };

  it('accepts a valid answer', async () => {
    const result = (await pipe.transform(
      { answer: 'Es talla M' },
      metadata,
    )) as AnswerQuestionDto;

    expect(result).toEqual({ answer: 'Es talla M' });
  });

  it('rejects an empty answer', async () => {
    await expect(pipe.transform({ answer: '' }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a whitespace-only answer', async () => {
    await expect(pipe.transform({ answer: '   ' }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('trims the answer before validating and storing it', async () => {
    const result = (await pipe.transform(
      { answer: '  Es talla M  ' },
      metadata,
    )) as AnswerQuestionDto;

    expect(result.answer).toBe('Es talla M');
  });

  it('rejects an answer longer than 1000 characters', async () => {
    await expect(
      pipe.transform({ answer: 'a'.repeat(1001) }, metadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('strips unexpected fields', async () => {
    const result = (await pipe.transform(
      { answer: 'Es talla M', answeredAt: '2026-01-01' },
      metadata,
    )) as AnswerQuestionDto;

    expect(result).toEqual({ answer: 'Es talla M' });
    expect('answeredAt' in result).toBe(false);
  });
});
