import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateUserDto {
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(80, { message: 'El nombre no puede superar los 80 caracteres' })
  @ValidateIf((_object, value) => value !== undefined)
  name?: string;

  @IsEmail({}, { message: 'Ingresa un correo electrónico válido' })
  @MaxLength(255, {
    message: 'El correo electrónico no puede superar los 255 caracteres',
  })
  @ValidateIf((_object, value) => value !== undefined)
  email?: string;

  @IsString({ message: 'La contraseña debe ser un texto' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @ValidateIf((_object, value) => value !== undefined)
  password?: string;

  // Only required when a user updates their own email or password
  // (PATCH /users/me). Admins recovering another account do not send it.
  @IsString({ message: 'La contraseña actual debe ser un texto' })
  @ValidateIf((_object, value) => value !== undefined)
  currentPassword?: string;
}
