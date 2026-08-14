import { IsNotEmpty, IsString } from 'class-validator';
import { IsPassword } from '../../common/password-validation';

export class ResetPasswordDto {
  @IsString({ message: 'El token debe ser un texto' })
  @IsNotEmpty({ message: 'El token es obligatorio' })
  token!: string;

  @IsPassword()
  password!: string;
}
