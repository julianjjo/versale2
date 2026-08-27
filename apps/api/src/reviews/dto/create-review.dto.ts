import {
  IsInt,
  IsString,
  IsOptional,
  Min,
  Max,
  IsNotEmpty,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateReviewDto {
  @IsString({ message: 'El producto seleccionado no es válido' })
  @IsNotEmpty({ message: 'Debes indicar el producto que quieres calificar' })
  productId!: string;

  @IsInt({ message: 'La calificación debe ser un número entero de estrellas' })
  @Min(1, { message: 'La calificación mínima es 1 estrella' })
  @Max(5, { message: 'La calificación máxima es 5 estrellas' })
  rating!: number;

  @IsOptional()
  @IsString({ message: 'El comentario debe ser un texto' })
  // @IsOptional() only skips validation for a missing/null/undefined value —
  // an explicit "" or "   " still reaches Matches/MaxLength below, same as
  // every other free-text field in this API (sellerReply, questions,
  // report descriptions) already enforces.
  @Matches(/\S/, { message: 'El comentario no puede quedar en blanco' })
  @MaxLength(1000, {
    message: 'El comentario no puede superar los 1000 caracteres',
  })
  comment?: string;
}
