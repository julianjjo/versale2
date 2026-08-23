import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// Opcionales y solo http(s): MP exige back_urls válidas y el fallback del
// controller ya cubre su ausencia — aquí solo se acota lo que el cliente
// puede mandar. require_tld: false permite localhost en desarrollo.
export class MpBackUrlsDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl({ protocols: ['https', 'http'], require_tld: false })
  success?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl({ protocols: ['https', 'http'], require_tld: false })
  failure?: string;
}

export class CreateMpPreferenceDto {
  @IsString({ message: 'orderId debe ser un texto' })
  @IsNotEmpty({ message: 'orderId es obligatorio' })
  orderId!: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MpBackUrlsDto)
  backUrls?: MpBackUrlsDto;
}
