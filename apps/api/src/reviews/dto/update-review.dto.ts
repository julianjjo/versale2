import {
  IsInt,
  IsString,
  IsOptional,
  Min,
  Max,
  ValidateIf,
  Matches,
  MaxLength,
} from 'class-validator';

// Deliberately does NOT expose productId (or userId): a review can never be
// reassigned to another product or another author once it exists, otherwise the
// "cannot review your own product" and one-review-per-product rules enforced in
// create() could be bypassed through an update.
export class UpdateReviewDto {
  // ValidateIf (not IsOptional) so the field means "omit it to leave the rating
  // unchanged, but if you send it — including an explicit null — it must be a
  // valid 1-5 int". IsOptional would also skip validation for null, letting it
  // reach Prisma's non-nullable Review.rating column and crash with a 500.
  @IsInt({ message: 'La calificación debe ser un número entero de estrellas' })
  @Min(1, { message: 'La calificación mínima es 1 estrella' })
  @Max(5, { message: 'La calificación máxima es 5 estrellas' })
  @ValidateIf((_object, value) => value !== undefined)
  rating?: number;

  @IsString({ message: 'El comentario debe ser un texto' })
  @IsOptional()
  // Same reasoning as CreateReviewDto's own comment field: IsOptional only
  // skips an omitted/null/undefined value, so an explicit "" or "   " still
  // has to clear these.
  @Matches(/\S/, { message: 'El comentario no puede quedar en blanco' })
  @MaxLength(1000, {
    message: 'El comentario no puede superar los 1000 caracteres',
  })
  comment?: string;
}
