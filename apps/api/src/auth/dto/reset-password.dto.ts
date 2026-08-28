/* eslint-disable @typescript-eslint/no-unsafe-return -- Transform value is any from class-transformer */
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsPassword } from '../../common/password-validation';

export class ResetPasswordDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El token debe ser un texto' })
  @IsNotEmpty({ message: 'El token es obligatorio' })
  token!: string;

  @IsPassword()
  password!: string;
}
