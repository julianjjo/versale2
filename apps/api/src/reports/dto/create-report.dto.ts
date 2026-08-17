import { IsEnum, IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ReportCategory } from '@prisma/client';
import { Trim } from '../../common/trim.decorator';

export class CreateReportDto {
  @IsString({ message: 'El producto seleccionado no es válido' })
  @IsNotEmpty({ message: 'Debes indicar el producto que quieres reportar' })
  productId!: string;

  @IsEnum(ReportCategory, {
    message: 'Selecciona un motivo válido para el reporte',
  })
  category!: ReportCategory;

  @IsString({ message: 'El motivo debe ser un texto' })
  @IsNotEmpty({
    message: 'Cuéntanos por qué estás reportando esta publicación',
  })
  @MaxLength(500, {
    message: 'El motivo no puede superar los 500 caracteres',
  })
  @Trim()
  reason!: string;
}
