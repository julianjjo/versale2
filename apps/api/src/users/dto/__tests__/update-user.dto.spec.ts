import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
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

  it('keeps currentPassword so the self-service credential check can run', async () => {
    const result = await pipe.transform(
      { password: 'longenough', currentPassword: 'oldpassword' },
      metadata,
    );

    expect(result).toEqual({
      password: 'longenough',
      currentPassword: 'oldpassword',
    });
  });
});

describe('UpdateUserDto field constraints', () => {
  it('rejects an empty name', async () => {
    const dto = plainToInstance(UpdateUserDto, { name: '' });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });

  it('rejects a name longer than the allowed maximum', async () => {
    const dto = plainToInstance(UpdateUserDto, { name: 'a'.repeat(5000) });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });

  it('accepts a reasonable name', async () => {
    const dto = plainToInstance(UpdateUserDto, { name: 'Ana Gómez' });

    const errors = await validate(dto);

    expect(errors).toEqual([]);
  });

  it('rejects a password shorter than the signup minimum', async () => {
    const dto = plainToInstance(UpdateUserDto, { password: 'a' });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  it('accepts a password that meets the signup minimum', async () => {
    const dto = plainToInstance(UpdateUserDto, { password: '123456' });

    const errors = await validate(dto);

    expect(errors).toEqual([]);
  });
});

describe('UpdateUserDto validation with explicit null vs omitted (undefined) fields', () => {
  it('rejects an explicit null name with a validation error', async () => {
    const dto = plainToInstance(UpdateUserDto, { name: null });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });

  it('allows an omitted (undefined) name with no validation errors', async () => {
    const dto = plainToInstance(UpdateUserDto, {});

    const errors = await validate(dto);

    expect(errors).toEqual([]);
  });

  it('rejects an explicit null email with a validation error', async () => {
    const dto = plainToInstance(UpdateUserDto, { email: null });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  it('allows an omitted (undefined) email with no validation errors', async () => {
    const dto = plainToInstance(UpdateUserDto, {});

    const errors = await validate(dto);

    expect(errors).toEqual([]);
  });

  it('rejects an explicit null password with a validation error', async () => {
    const dto = plainToInstance(UpdateUserDto, { password: null });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  it('allows an omitted (undefined) password with no validation errors', async () => {
    const dto = plainToInstance(UpdateUserDto, {});

    const errors = await validate(dto);

    expect(errors).toEqual([]);
  });
});
