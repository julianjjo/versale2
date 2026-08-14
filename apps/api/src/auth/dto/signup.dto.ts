import { IsEmail, IsString, IsNotEmpty } from 'class-validator';
import { IsPassword } from '../../common/password-validation';

export class SignupDto {
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido' })
  email!: string;

  @IsPassword()
  password!: string;

  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string;
}
