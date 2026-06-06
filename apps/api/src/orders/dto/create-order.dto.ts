import { IsObject, IsNotEmptyObject, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @IsOptional()
  @IsObject()
  @IsNotEmptyObject()
  shippingAddress?: Record<string, unknown>;
}
