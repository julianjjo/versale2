/* eslint-disable @typescript-eslint/no-unsafe-return -- Transform value is any from class-transformer */
import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';

// Every listing is a single second-hand garment (there is no stock column and a
// purchase marks the whole product as sold), so one unit per line is the only
// quantity that can actually be fulfilled.
export const MAX_ITEM_QUANTITY = 1;

export class AddCartItemDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El producto seleccionado no es válido' })
  @IsNotEmpty({ message: 'Debes seleccionar un producto' })
  productId!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? Number(value.trim()) : value,
  )
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser de al menos 1 unidad' })
  @Max(MAX_ITEM_QUANTITY, {
    message: `Cada prenda es única: solo puedes llevar ${MAX_ITEM_QUANTITY} unidad de este producto`,
  })
  quantity!: number;
}

export class UpdateCartItemDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? Number(value.trim()) : value,
  )
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser de al menos 1 unidad' })
  @Max(MAX_ITEM_QUANTITY, {
    message: `Cada prenda es única: solo puedes llevar ${MAX_ITEM_QUANTITY} unidad de este producto`,
  })
  quantity!: number;
}
