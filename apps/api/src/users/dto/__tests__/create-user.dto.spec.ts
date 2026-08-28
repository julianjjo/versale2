import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateUserDto } from '../create-user.dto';

describe('CreateUserDto with the global ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = {
    type: 'body' as const,
    metatype: CreateUserDto,
  };

  it('accepts a valid user', async () => {
    const result = (await pipe.transform(
      { email: 'test@example.com', name: 'Alice', password: 'secret123' },
      metadata,
    )) as CreateUserDto;

    expect(result.email).toBe('test@example.com');
    expect(result.name).toBe('Alice');
  });

  it('rejects a missing email', async () => {
    await expect(
      pipe.transform({ name: 'Alice', password: 'secret123' }, metadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a whitespace-only name', async () => {
    await expect(
      pipe.transform(
        { email: 'test@example.com', name: '   ', password: 'secret123' },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('trims the email before validating and storing it', async () => {
    const result = (await pipe.transform(
      {
        email: '  test@example.com  ',
        name: 'Alice',
        password: 'secret123',
      },
      metadata,
    )) as CreateUserDto;

    expect(result.email).toBe('test@example.com');
  });

  it('trims the name before validating and storing it', async () => {
    const result = (await pipe.transform(
      { email: 'test@example.com', name: '  Alice  ', password: 'secret123' },
      metadata,
    )) as CreateUserDto;

    expect(result.name).toBe('Alice');
  });

  it('rejects a whitespace-only email (trimmed to empty)', async () => {
    await expect(
      pipe.transform(
        { email: '   ', name: 'Alice', password: 'secret123' },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
