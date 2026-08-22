import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IsPassword, PASSWORD_MIN_LENGTH } from '../password-validation';

class TestDto {
  @IsPassword()
  password!: string;
}

describe('IsPassword', () => {
  it('rejects a non-string password', async () => {
    const dto = plainToInstance(TestDto, { password: 12345678 });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  it('rejects a password shorter than the minimum length', async () => {
    const dto = plainToInstance(TestDto, {
      password: 'a'.repeat(PASSWORD_MIN_LENGTH - 1),
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  it('accepts a password meeting the minimum length', async () => {
    const dto = plainToInstance(TestDto, {
      password: 'a'.repeat(PASSWORD_MIN_LENGTH),
    });

    const errors = await validate(dto);

    expect(errors).toEqual([]);
  });

  it('rejects a password from the common-password blocklist, case-insensitively', async () => {
    const dto = plainToInstance(TestDto, { password: 'Password123' });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  it('accepts a long-enough password that is not on the blocklist', async () => {
    const dto = plainToInstance(TestDto, { password: 'correct-horse-battery' });

    const errors = await validate(dto);

    expect(errors).toEqual([]);
  });
});
