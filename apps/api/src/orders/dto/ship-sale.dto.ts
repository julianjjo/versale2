import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ShipSaleDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() || undefined : value))
  @IsString({ message: 'El número de guía debe ser un texto' })
  @MaxLength(100, {
    message: 'El número de guía no puede superar los 100 caracteres',
  })
  trackingNumber?: string;
}
