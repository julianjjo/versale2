import { applyDecorators } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';

// Single source of truth for the password rule so it can't drift between
// DTOs again (signup, profile update, and reset had each grown their own
// copy of this same string+length check).
export const PASSWORD_MIN_LENGTH = 6;

export function IsPassword(): PropertyDecorator {
  return applyDecorators(
    IsString({ message: 'La contraseña debe ser un texto' }),
    MinLength(PASSWORD_MIN_LENGTH, {
      message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    }),
  );
}
