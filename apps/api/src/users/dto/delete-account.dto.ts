import { IsString, MinLength } from 'class-validator';

/**
 * Borrado de cuenta: la contraseña actual es la prueba de que quien pide la
 * eliminación es el dueño legítimo — el mismo patrón self-service que ya
 * exige `update()` antes de tocar credenciales. Sin ella, una sesión robada
 * (token sustraído, pestaña olvidada) podría borrar la cuenta de un tirón.
 */
export class DeleteAccountDto {
  @IsString()
  @MinLength(1, { message: 'Debes confirmar tu contraseña actual' })
  currentPassword!: string;
}
