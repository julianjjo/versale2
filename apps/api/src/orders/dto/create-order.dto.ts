import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Trim } from '../../common/trim.decorator';

export class ShippingAddressDto {
  @IsString({ message: 'La dirección debe ser un texto' })
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  @MaxLength(200, {
    message: 'La dirección no puede superar los 200 caracteres',
  })
  @Trim()
  street!: string;

  @IsString({ message: 'La ciudad debe ser un texto' })
  @IsNotEmpty({ message: 'La ciudad es obligatoria' })
  @MaxLength(100, { message: 'La ciudad no puede superar los 100 caracteres' })
  @Trim()
  city!: string;

  // The checkout form leaves departamento and código postal optional, so they
  // are validated as strings but may arrive empty.
  @IsString({ message: 'El departamento debe ser un texto' })
  @IsOptional()
  @MaxLength(100, {
    message: 'El departamento no puede superar los 100 caracteres',
  })
  @Trim()
  state?: string;

  @IsString({ message: 'El código postal debe ser un texto' })
  @IsOptional()
  @MaxLength(20, {
    message: 'El código postal no puede superar los 20 caracteres',
  })
  @Trim()
  zip?: string;

  @IsString({ message: 'El país debe ser un texto' })
  @IsNotEmpty({ message: 'El país es obligatorio' })
  @MaxLength(100, { message: 'El país no puede superar los 100 caracteres' })
  @Trim()
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
