/* eslint-disable @typescript-eslint/no-unsafe-return -- Transform value is any from class-transformer */
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsInt,
  IsPositive,
  IsArray,
  ArrayMaxSize,
  Max,
  MaxLength,
  ValidateNested,
  Validate,
  IsUrl,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PRODUCT_CATEGORIES } from '../categories';

// Item 4: image URLs must point at our own uploads bucket. The roadmap's
// closed decision: no free external URLs — they enable hotlinking, phishing
// and bait-and-switch photos (a URL whose content changes after publication).
// The bucket host comes from R2_PUBLIC_BASE_URL, the same value
// UploadsService uses to build the URLs it returns, so the allowlist and the
// producer of URLs can never drift apart.
@ValidatorConstraint({ name: 'isBucketImageUrl', async: false })
export class IsBucketImageUrlConstraint implements ValidatorConstraintInterface {
  validate(url: unknown) {
    if (typeof url !== 'string') {
      return false;
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'https:') {
      return false;
    }
    const base = process.env.R2_PUBLIC_BASE_URL;
    if (!base) {
      // Without a configured bucket there is no allowlist; only local dev
      // hosts pass so a developer without R2 credentials can still exercise
      // the flow. Production always sets R2_PUBLIC_BASE_URL.
      return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
    }
    try {
      return parsed.hostname === new URL(base).hostname;
    } catch {
      return false;
    }
  }

  defaultMessage() {
    return 'Cada imagen debe ser una URL del bucket de uploads de Versale';
  }
}

export class ProductImageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsUrl(
    { require_tld: false },
    { message: 'Cada imagen debe ser una URL válida' },
  )
  @Validate(IsBucketImageUrlConstraint)
  url!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El texto alternativo debe ser un texto' })
  @IsNotEmpty({ message: 'Cada imagen requiere una descripción (alt)' })
  @Matches(/\S/, { message: 'Cada imagen requiere una descripción (alt)' })
  @MaxLength(150, {
    message: 'La descripción de la imagen no puede superar los 150 caracteres',
  })
  alt!: string;
}

export class CreateProductDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El título debe ser un texto' })
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @Matches(/\S/, { message: 'El título es obligatorio' })
  @MaxLength(120, { message: 'El título no puede superar los 120 caracteres' })
  title!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'La descripción debe ser un texto' })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @Matches(/\S/, { message: 'La descripción es obligatoria' })
  @MaxLength(2000, {
    message: 'La descripción no puede superar los 2000 caracteres',
  })
  description!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'La categoría debe ser un texto' })
  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  @IsIn(PRODUCT_CATEGORIES, {
    message: `La categoría debe ser una de: ${PRODUCT_CATEGORIES.join(', ')}`,
  })
  category!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString({ message: 'La marca debe ser un texto' })
  @MaxLength(100, { message: 'La marca no puede superar los 100 caracteres' })
  brand?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'La talla debe ser un texto' })
  @IsNotEmpty({ message: 'La talla es obligatoria' })
  @IsIn(['XS', 'S', 'M', 'L', 'XL', 'XXL'], {
    message: 'La talla debe ser XS, S, M, L, XL o XXL',
  })
  size!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'La condición debe ser un texto' })
  @IsNotEmpty({ message: 'La condición es obligatoria' })
  @IsIn(['New', 'Like New', 'Good', 'Fair'], {
    message:
      'La condición debe ser New (nuevo), Like New (como nuevo), Good (buen estado) o Fair (aceptable)',
  })
  condition!: string;

  // COP has no subunit in practice and the whole UI formats prices without
  // decimals, so only whole pesos are accepted.
  @Transform(({ value }) =>
    typeof value === 'string' ? Number(value.trim()) : value,
  )
  @IsInt({
    message: 'El precio debe ser un número entero de pesos, sin decimales',
  })
  @IsPositive({ message: 'El precio debe ser mayor a 0' })
  @Max(100_000_000, {
    message: 'El precio no puede superar los 100.000.000 de pesos',
  })
  price!: number;

  @IsOptional()
  @IsArray({ message: 'Las imágenes deben enviarse como una lista' })
  @ArrayMaxSize(6, {
    message: 'No puedes publicar más de 6 imágenes por producto',
  })
  @ValidateNested({ each: true, message: 'Imagen inválida' })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];

  // Item 4: seller-curated free text. Optional — a listing without them is
  // valid — but bounded so a listing can't become an essay.
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString({ message: 'Las medidas deben ser un texto' })
  @MaxLength(1000, {
    message: 'Las medidas no pueden superar los 1000 caracteres',
  })
  measurements?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString({ message: 'Los defectos deben ser un texto' })
  @MaxLength(1000, {
    message: 'Los defectos no pueden superar los 1000 caracteres',
  })
  defects?: string;
}
