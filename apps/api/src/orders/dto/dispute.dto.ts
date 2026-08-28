/* eslint-disable @typescript-eslint/no-unsafe-return -- Transform value is any from class-transformer */
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';
import { IsBucketImageUrlConstraint } from '../../products/dto/create-product.dto';

// Item 12 (roadmap 2.2, regla cerrada): las fotos son obligatorias — una
// disputa sin evidencia no es revisable. Reutilizan /uploads/images, que ya
// valida magic bytes, así que la URL es de un archivo que SÍ es imagen.
export class CreateDisputeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El motivo debe ser un texto' })
  @MinLength(20, { message: 'Describe el motivo con al menos 20 caracteres' })
  @MaxLength(1000, {
    message: 'El motivo no puede superar los 1000 caracteres',
  })
  reason!: string;

  @IsArray({ message: 'Las fotos deben enviarse como una lista' })
  @ArrayMinSize(1, { message: 'Adjunta al menos una foto como evidencia' })
  @ArrayMaxSize(6, { message: 'Máximo 6 fotos por disputa' })
  @IsUrl(
    { require_tld: false },
    { each: true, message: 'Cada foto debe ser una URL válida' },
  )
  @Validate(IsBucketImageUrlConstraint, { each: true })
  photos!: string[];
}
