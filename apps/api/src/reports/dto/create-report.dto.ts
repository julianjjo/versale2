import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

// Trim before validating so a whitespace-only reason cannot pass @IsNotEmpty
// and end up stored (and shown to an admin) as a blank complaint.
const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CreateReportDto {
  @IsString({ message: 'El producto seleccionado no es válido' })
  @IsNotEmpty({ message: 'Debes indicar el producto que quieres reportar' })
  productId!: string;

  @IsString({ message: 'El motivo debe ser un texto' })
  @IsNotEmpty({ message: 'Cuéntanos por qué estás reportando esta publicación' })
  @MaxLength(500, {
    message: 'El motivo no puede superar los 500 caracteres',
  })
  @Trim()
  reason!: string;
}
