import { IsInt, IsString, IsOptional, Min, Max } from 'class-validator';

// Deliberately does NOT expose productId (or userId): a review can never be
// reassigned to another product or another author once it exists, otherwise the
// "cannot review your own product" and one-review-per-product rules enforced in
// create() could be bypassed through an update.
export class UpdateReviewDto {
  @IsInt({ message: 'La calificación debe ser un número entero de estrellas' })
  @Min(1, { message: 'La calificación mínima es 1 estrella' })
  @Max(5, { message: 'La calificación máxima es 5 estrellas' })
  @IsOptional()
  rating?: number;

  @IsString({ message: 'El comentario debe ser un texto' })
  @IsOptional()
  comment?: string;
}
