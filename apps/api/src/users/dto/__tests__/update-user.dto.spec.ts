import { ValidationPipe } from '@nestjs/common';
import { UpdateUserDto } from '../update-user.dto';

describe('UpdateUserDto with the global ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = {
    type: 'body' as const,
    metatype: UpdateUserDto,
  };

  it('strips fields not declared on the DTO, e.g. an injected role', async () => {
    const result = await pipe.transform(
      { name: 'Updated Name', role: 'ADMIN' },
      metadata,
    );

    expect(result).toBeInstanceOf(UpdateUserDto);
    expect(result).toEqual({ name: 'Updated Name' });
    expect((result as Record<string, unknown>).role).toBeUndefined();
  });

  it('strips isVerified when injected alongside a legitimate field', async () => {
    const result = await pipe.transform(
      { email: 'new@example.com', isVerified: true },
      metadata,
    );

    expect(result).toEqual({ email: 'new@example.com' });
    expect((result as Record<string, unknown>).isVerified).toBeUndefined();
  });

  it('passes through only the allowed optional fields untouched', async () => {
    const result = await pipe.transform(
      { name: 'New Name', email: 'new@example.com', password: 'longenough' },
      metadata,
    );

    expect(result).toEqual({
      name: 'New Name',
      email: 'new@example.com',
      password: 'longenough',
    });
  });
});
