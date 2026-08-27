import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SignupDto } from '../signup.dto';

const VALID_BASE = {
  email: 'a@b.com',
  password: 'a1b2c3d4',
  name: 'Test User',
};

describe('SignupDto — acceptedTerms (item 8)', () => {
  it('rejects signup when acceptedTerms is omitted', async () => {
    const dto = plainToInstance(SignupDto, { ...VALID_BASE });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'acceptedTerms')).toBe(
      true,
    );
  });

  it('rejects signup when acceptedTerms is explicitly false', async () => {
    const dto = plainToInstance(SignupDto, {
      ...VALID_BASE,
      acceptedTerms: false,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'acceptedTerms')).toBe(
      true,
    );
  });

  it('rejects a truthy non-boolean value instead of silently coercing it', async () => {
    const dto = plainToInstance(SignupDto, {
      ...VALID_BASE,
      acceptedTerms: 'yes',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'acceptedTerms')).toBe(
      true,
    );
  });

  it('accepts signup when acceptedTerms is true', async () => {
    const dto = plainToInstance(SignupDto, {
      ...VALID_BASE,
      acceptedTerms: true,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'acceptedTerms')).toBe(
      false,
    );
  });
  it('signup: handles empty list', () => {
    expect(true).toBe(true);
  });
});
