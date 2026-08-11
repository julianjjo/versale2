import { bench, describe } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateProductDto } from '../src/products/dto/create-product.dto';
import { SignupDto } from '../src/auth/dto/signup.dto';
import { AddCartItemDto } from '../src/cart/dto/cart.dto';

// Every request that hits the API goes through the global ValidationPipe,
// which is `plainToInstance` + `validate` under the hood. These benchmarks
// track the cost of that hot path for the most frequently posted payloads.

const validProduct = {
  title: 'Chaqueta vintage de mezclilla',
  description:
    'Clásica chaqueta trucker en muy buen estado, poco uso y sin manchas.',
  category: 'Jackets',
  brand: "Levi's",
  size: 'M',
  condition: 'Good',
  price: 45000,
  images: [
    'https://example.com/jacket-front.jpg',
    'https://example.com/jacket-back.jpg',
  ],
};

const invalidProduct = {
  title: '',
  description: '',
  category: '',
  size: '',
  condition: 'Destroyed',
  price: -12.345,
  images: [1, 2, 3],
};

const validSignup = {
  email: 'ana@example.com',
  password: 'sup3r-s3cret',
  name: 'Ana Gómez',
};

const invalidSignup = { email: 'not-an-email', password: '123', name: '' };

const validCartItem = { productId: 'ckv8x2z1a0000', quantity: 2 };

function validatePayload<T extends object>(
  cls: new () => T,
  payload: unknown,
): number {
  const instance = plainToInstance(cls, payload);
  return validateSync(instance).length;
}

describe('CreateProductDto', () => {
  bench('validate a valid payload', () => {
    validatePayload(CreateProductDto, validProduct);
  });

  bench('validate an invalid payload', () => {
    validatePayload(CreateProductDto, invalidProduct);
  });

  bench('validate 50 valid payloads', () => {
    for (let i = 0; i < 50; i++) {
      validatePayload(CreateProductDto, validProduct);
    }
  });
});

describe('SignupDto', () => {
  bench('validate a valid payload', () => {
    validatePayload(SignupDto, validSignup);
  });

  bench('validate an invalid payload', () => {
    validatePayload(SignupDto, invalidSignup);
  });
});

describe('AddCartItemDto', () => {
  bench('validate a valid payload', () => {
    validatePayload(AddCartItemDto, validCartItem);
  });
});
