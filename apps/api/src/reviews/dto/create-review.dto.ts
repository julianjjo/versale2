import {
  IsInt,
  IsString,
  IsOptional,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';

export class CreateReviewDto {
  @IsString({ message: 'El producto seleccionado no es válido' })
  @IsNotEmpty({ message: 'Debes indicar el producto que quieres calificar' })
  productId!: string;

  @IsInt({ message: 'La calificación debe ser un número entero de estrellas' })
  @Min(1, { message: 'La calificación mínima es 1 estrella' })
  @Max(5, { message: 'La calificación máxima es 5 estrellas' })
  rating!: number;

  @IsString({ message: 'El comentario debe ser un texto' })
  @IsOptional()
  comment?: string;
}
