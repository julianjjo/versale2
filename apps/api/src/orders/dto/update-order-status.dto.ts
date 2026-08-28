/* eslint-disable @typescript-eslint/no-unsafe-return -- Transform value is any from class-transformer */
import { Transform } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { OrderStatus } from '../order-status.enum';

export class UpdateOrderStatusDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEnum(OrderStatus, {
    message:
      'El estado del pedido debe ser PENDING (pendiente), PAID (pagado), SHIPPED (enviado), DELIVERED (entregado) o CANCELLED (cancelado)',
  })
  status!: OrderStatus;
}
