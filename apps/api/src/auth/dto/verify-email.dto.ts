import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @IsString({ message: 'El token debe ser un texto' })
  @IsNotEmpty({ message: 'El token es obligatorio' })
  token!: string;
}
