/* eslint-disable @typescript-eslint/no-unsafe-return -- Transform value is any from class-transformer */
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El token debe ser un texto' })
  @IsNotEmpty({ message: 'El token es obligatorio' })
  token!: string;
}
