/* eslint-disable @typescript-eslint/no-unsafe-return -- Transform value is any from class-transformer */
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido' })
  email!: string;
}
