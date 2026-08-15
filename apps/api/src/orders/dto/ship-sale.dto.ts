import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ShipSaleDto {
  @IsString({ message: 'El número de guía debe ser un texto' })
  @MaxLength(100, {
    message: 'El número de guía no puede superar los 100 caracteres',
  })
  @IsOptional()
  trackingNumber?: string;
}
