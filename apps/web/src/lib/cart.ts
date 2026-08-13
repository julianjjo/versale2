/**
 * Every listing is a single secondhand garment, so a cart line can only ever
 * hold one unit. The API enforces the same ceiling (`MAX_ITEM_QUANTITY` in
 * apps/api/src/cart/dto/cart.dto.ts, on both cart DTOs and in
 * `CartService.assertValidQuantity`); this constant keeps the inputs from
 * offering a value the server would reject.
 */
export const MAX_ITEM_QUANTITY = 1;
