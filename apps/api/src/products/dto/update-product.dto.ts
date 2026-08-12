import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsInt,
  IsPositive,
  IsArray,
  Max,
  MaxLength,
} from 'class-validator';

// Every field is optional, but a field that IS sent has to satisfy the same
// rules `CreateProductDto` enforces. `@IsOptional()` only short-circuits on
// null/undefined, so without `@IsNotEmpty()` an empty string sails through and
// blanks a live listing.
export class UpdateProductDto {
  @IsString({ message: 'El título debe ser un texto' })
  @IsOptional()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MaxLength(120, { message: 'El título no puede superar los 120 caracteres' })
  title?: string;

  @IsString({ message: 'La descripción debe ser un texto' })
  @IsOptional()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(2000, {
    message: 'La descripción no puede superar los 2000 caracteres',
  })
  description?: string;

  @IsString({ message: 'La categoría debe ser un texto' })
  @IsOptional()
  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  category?: string;

  @IsString({ message: 'La marca debe ser un texto' })
  @IsOptional()
  brand?: string;

  @IsString({ message: 'La talla debe ser un texto' })
  @IsOptional()
  @IsIn(['XS', 'S', 'M', 'L', 'XL', 'XXL'], {
    message: 'La talla debe ser XS, S, M, L, XL o XXL',
  })
  size?: string;

  @IsString({ message: 'La condición debe ser un texto' })
  @IsOptional()
  @IsIn(['New', 'Like New', 'Good', 'Fair'], {
    message:
      'La condición debe ser New (nuevo), Like New (como nuevo), Good (buen estado) o Fair (aceptable)',
  })
  condition?: string;

  // COP has no subunit in practice and the whole UI formats prices without
  // decimals, so only whole pesos are accepted.
  @IsInt({
    message: 'El precio debe ser un número entero de pesos, sin decimales',
  })
  @IsOptional()
  @IsPositive({ message: 'El precio debe ser mayor a 0' })
  @Max(100_000_000, {
    message: 'El precio no puede superar los 100.000.000 de pesos',
  })
  price?: number;

  @IsArray({ message: 'Las imágenes deben enviarse como una lista' })
  @IsString({
    each: true,
    message: 'Cada imagen debe ser una URL en texto',
  })
  @IsOptional()
  images?: string[];
}
