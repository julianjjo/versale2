import type { APIRequestContext } from "@playwright/test";
import { E2E_USERS } from "./seed";

export const API_URL = "http://127.0.0.1:3101";

/**
 * A shipping address that satisfies the API's ShippingAddressDto.
 * `POST /orders` rejects a missing or empty address, so every checkout in the
 * suite has to send a real one.
 */
export const E2E_SHIPPING_ADDRESS = {
  street: "Calle 100 #20-30",
  city: "Bogotá",
  state: "Cundinamarca",
  zip: "110111",
  country: "Colombia",
};

async function login(
  request: APIRequestContext,
  credentials: { email: string; password: string },
): Promise<string> {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email: credentials.email, password: credentials.password },
  });
  if (!res.ok()) {
    throw new Error(
      `No se pudo iniciar sesión como ${credentials.email}: ${res.status()} ${await res.text()}`,
    );
  }
  return (await res.json()).access_token;
}

export async function getToken(
  request: APIRequestContext,
  who: keyof typeof E2E_USERS,
): Promise<string> {
  return login(request, E2E_USERS[who]);
}

/**
 * Creates a fresh, admin-approved product owned by the seeded author, and
 * returns it ready to be bought by the seeded `user`.
 *
 * Products are one-of-a-kind: checkout stamps `soldAt` and the item leaves the
 * catalog for good. So a purchase test cannot reuse a shared seeded product —
 * it would pass once and then fail on the next run or on a CI retry. Each test
 * mints its own item instead.
 */
export async function createPurchasableProduct(
  request: APIRequestContext,
  overrides: Partial<{ title: string; price: number }> = {},
): Promise<{ id: string; title: string; price: number }> {
  const authorToken = await getToken(request, "author");
  const adminToken = await getToken(request, "admin");

  // Date.now() alone is millisecond-resolution, and specs run in parallel — two
  // products can land on the same title. The sold-out spec asserts on a
  // title search returning zero, so a same-named unsold twin would break it.
  const title =
    overrides.title ??
    `Prenda de prueba ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const price = overrides.price ?? 50000;

  const created = await request.post(`${API_URL}/products`, {
    headers: { Authorization: `Bearer ${authorToken}` },
    data: {
      title,
      description: "Prenda creada por la suite e2e para probar la compra.",
      category: "Jackets",
      size: "M",
      condition: "Good",
      price,
    },
  });
  if (!created.ok()) {
    throw new Error(
      `No se pudo crear el producto de prueba: ${created.status()} ${await created.text()}`,
    );
  }
  const product = await created.json();

  const approved = await request.patch(
    `${API_URL}/products/admin/${product.id}/approve`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {},
    },
  );
  if (!approved.ok()) {
    throw new Error(
      `No se pudo aprobar el producto de prueba: ${approved.status()} ${await approved.text()}`,
    );
  }

  return { id: product.id, title, price };
}

/**
 * Registers a throwaway buyer and returns its token.
 *
 * The seeded `user` has ONE cart, and spec files run in parallel — so two tests
 * that both drive that account can interleave, and a checkout in one will sweep
 * up whatever the other just added. That used to be harmless; now that checkout
 * stamps `soldAt`, it permanently consumes a seeded product and breaks every
 * later test that expected it in the catalog. A test that checks out therefore
 * gets its own buyer, and its own cart.
 */
export const E2E_BUYER_PASSWORD = "password123";

export async function createBuyer(
  request: APIRequestContext,
): Promise<{ token: string; email: string; password: string }> {
  const email = `buyer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.test`;
  const res = await request.post(`${API_URL}/auth/signup`, {
    data: { email, name: "Comprador E2E", password: E2E_BUYER_PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(
      `No se pudo registrar el comprador de prueba: ${res.status()} ${await res.text()}`,
    );
  }
  return {
    token: (await res.json()).access_token,
    email,
    password: E2E_BUYER_PASSWORD,
  };
}

/**
 * Empties the given user's cart so a test starts from a known state.
 *
 * Throws on failure: a silently-failed cleanup leaves the caller asserting
 * against leftover items while believing the cart is empty, which is exactly
 * the kind of shared-state bug this helper exists to prevent.
 */
export async function clearCart(
  request: APIRequestContext,
  token: string,
): Promise<void> {
  const response = await request.delete(`${API_URL}/cart`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok()) {
    throw new Error(
      `No se pudo vaciar el carrito de prueba: ${response.status()} ${await response.text()}`,
    );
  }
}
