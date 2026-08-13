import { IsEnum } from 'class-validator';
import { OrderStatus } from '../order-status.enum';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus, {
    message:
      'El estado del pedido debe ser PENDING (pendiente), PAID (pagado), SHIPPED (enviado), DELIVERED (entregado) o CANCELLED (cancelado)',
  })
  status!: OrderStatus;
}
