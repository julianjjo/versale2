import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsBoolean,
  Equals,
} from 'class-validator';
import { IsPassword } from '../../common/password-validation';

export class SignupDto {
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido' })
  email!: string;

  @IsPassword()
  password!: string;

  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string;

  // Item 8: the signup checkbox ("mayor de 18 años" + Términos/Privacidad)
  // was only ever enforced client-side — a direct POST /auth/signup could
  // (and, per the frontend's own request payload, always did) skip it
  // entirely. `@Equals(true)` rather than just `@IsBoolean()` so an explicit
  // `false` is rejected exactly like an omitted field, instead of a caller
  // being able to satisfy "is a boolean" while still not consenting.
  @IsBoolean({ message: 'Debes confirmar los términos como un valor booleano' })
  @Equals(true, {
    message: 'Debes confirmar que eres mayor de 18 años y aceptas los Términos',
  })
  acceptedTerms!: boolean;
}
