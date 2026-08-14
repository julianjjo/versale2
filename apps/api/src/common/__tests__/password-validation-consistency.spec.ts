import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResetPasswordDto } from '../../auth/dto/reset-password.dto';
import { SignupDto } from '../../auth/dto/signup.dto';
import { UpdateUserDto } from '../../users/dto/update-user.dto';
import { PASSWORD_MIN_LENGTH } from '../password-validation';

// Every DTO accepting a raw password shares the IsPassword() decorator, so
// this pins down that they all reject/accept the same boundary values —
// catching a future regression where one DTO's password rule drifts again.
type PasswordDtoConstructor = new () => object;

const DTOS_WITH_PASSWORD: Array<{
  name: string;
  ctor: PasswordDtoConstructor;
  extra: Record<string, unknown>;
}> = [
  {
    name: 'SignupDto',
    ctor: SignupDto,
    extra: { email: 'a@a.com', name: 'A' },
  },
  { name: 'UpdateUserDto', ctor: UpdateUserDto, extra: {} },
  {
    name: 'ResetPasswordDto',
    ctor: ResetPasswordDto,
    extra: { token: 'sometoken' },
  },
];

describe('password validation is consistent across DTOs', () => {
  it.each(DTOS_WITH_PASSWORD)(
    '$name rejects a password below the shared minimum length',
    async ({ ctor, extra }) => {
      const dto = plainToInstance(ctor, {
        ...extra,
        password: 'a'.repeat(PASSWORD_MIN_LENGTH - 1),
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'password')).toBe(true);
    },
  );

  it.each(DTOS_WITH_PASSWORD)(
    '$name accepts a password meeting the shared minimum length',
    async ({ ctor, extra }) => {
      const dto = plainToInstance(ctor, {
        ...extra,
        password: 'a'.repeat(PASSWORD_MIN_LENGTH),
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'password')).toBe(false);
    },
  );
});
