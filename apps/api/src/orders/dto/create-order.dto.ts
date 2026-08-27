/* eslint-disable @typescript-eslint/no-unsafe-return -- Transform value is any from class-transformer */
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ShippingAddressDto {
  @IsString({ message: 'La dirección debe ser un texto' })
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  @MaxLength(200, {
    message: 'La dirección no puede superar los 200 caracteres',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  street!: string;

  @IsString({ message: 'La ciudad debe ser un texto' })
  @IsNotEmpty({ message: 'La ciudad es obligatoria' })
  @MaxLength(100, { message: 'La ciudad no puede superar los 100 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  city!: string;

  // The checkout form leaves departamento and código postal optional, so they
  // are validated as strings but may arrive empty.
  @IsOptional()
  @IsString({ message: 'El departamento debe ser un texto' })
  @MaxLength(100, {
    message: 'El departamento no puede superar los 100 caracteres',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  state?: string;

  @IsOptional()
  @IsString({ message: 'El código postal debe ser un texto' })
  @MaxLength(20, {
    message: 'El código postal no puede superar los 20 caracteres',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  zip?: string;

  @IsString({ message: 'El país debe ser un texto' })
  @IsNotEmpty({ message: 'El país es obligatorio' })
  @MaxLength(100, { message: 'El país no puede superar los 100 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  country!: string;
}

export class CreateOrderDto {
  @IsDefined({ message: 'La dirección de envío es obligatoria' })
  @IsObject({ message: 'La dirección de envío no tiene un formato válido' })
  @ValidateNested({
    message: 'Revisa los datos de la dirección de envío',
  })
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;
}
