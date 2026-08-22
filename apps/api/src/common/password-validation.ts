import { applyDecorators } from '@nestjs/common';
import {
  IsString,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

// Single source of truth for the password rule so it can't drift between
// DTOs again (signup, profile update, and reset had each grown their own
// copy of this same string+length check).
export const PASSWORD_MIN_LENGTH = 8;

// The 30 weakest entries any public "most common passwords" list agrees on.
// Not meant to be exhaustive (this isn't zxcvbn) — just cheap enough to run
// on every signup/reset and enough to block the handful of guesses a
// throttled login endpoint can't stop an attacker from eventually trying.
const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'password123',
  'qwerty123',
  'qwertyuiop',
  '11111111',
  '00000000',
  'abc123456',
  'iloveyou',
  'admin1234',
  'welcome1',
  'letmein11',
  'monkey123',
  'dragon123',
  'football1',
  'baseball1',
  'sunshine1',
  'princess1',
  '87654321',
  'trustno1',
  '123123123',
  'contraseña',
  'contrasena',
  '12345678910',
  'passw0rd',
  'changeme1',
  'chocolate1',
]);

@ValidatorConstraint({ name: 'isNotCommonPassword', async: false })
export class IsNotCommonPasswordConstraint implements ValidatorConstraintInterface {
  validate(password: unknown) {
    if (typeof password !== 'string') return true; // IsString() owns this case.
    return !COMMON_PASSWORDS.has(password.toLowerCase());
  }

  defaultMessage() {
    return 'Esa contraseña es demasiado común; elige una distinta';
  }
}

export function IsPassword(): PropertyDecorator {
  return applyDecorators(
    IsString({ message: 'La contraseña debe ser un texto' }),
    MinLength(PASSWORD_MIN_LENGTH, {
      message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    }),
    Validate(IsNotCommonPasswordConstraint),
  );
}
