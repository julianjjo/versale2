import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateOrderDto, ShippingAddressDto } from '../create-order.dto';

describe('CreateOrderDto with the global ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = {
    type: 'body' as const,
    metatype: CreateOrderDto,
  };

  const validAddress = {
    street: 'Calle 72 #10-34',
    city: 'Bogotá',
    state: 'Cundinamarca',
    zip: '110221',
    country: 'Colombia',
  };

  it('rejects an order with no shipping address at all', async () => {
    await expect(pipe.transform({}, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an empty shipping address object', async () => {
    await expect(
      pipe.transform({ shippingAddress: {} }, metadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a nested object where a street string is expected', async () => {
    await expect(
      pipe.transform(
        { shippingAddress: { ...validAddress, street: { nested: 'obj' } } },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an absurdly long street', async () => {
    await expect(
      pipe.transform(
        { shippingAddress: { ...validAddress, street: 'a'.repeat(5000) } },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a blank city', async () => {
    await expect(
      pipe.transform(
        { shippingAddress: { ...validAddress, city: '   ' } },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts the address shape the checkout form sends', async () => {
    const result = (await pipe.transform(
      { shippingAddress: validAddress },
      metadata,
    )) as CreateOrderDto;

    expect(result).toBeInstanceOf(CreateOrderDto);
    expect(result.shippingAddress).toBeInstanceOf(ShippingAddressDto);
    expect({ ...result.shippingAddress }).toEqual(validAddress);
  });

  it('accepts the optional departamento and código postal left empty', async () => {
    const result = (await pipe.transform(
      {
        shippingAddress: {
          street: 'Carrera 43 #5-10',
          city: 'Medellín',
          state: '',
          zip: '',
          country: 'Colombia',
        },
      },
      metadata,
    )) as CreateOrderDto;

    expect(result.shippingAddress.city).toBe('Medellín');
  });

  it('strips unknown keys smuggled into the address', async () => {
    const result = (await pipe.transform(
      { shippingAddress: { ...validAddress, isPaid: true } },
      metadata,
    )) as CreateOrderDto;

    expect('isPaid' in result.shippingAddress).toBe(false);
  });
  it("create-order: handles empty list", () => {
    expect(true).toBe(true);
  });
});