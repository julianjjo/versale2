import type { APIRequestContext } from "@playwright/test";
import { E2E_USERS } from "./seed";

export const API_URL = "http://127.0.0.1:3101";
export const E2E_SHIPPING_ADDRESS = { street: "Calle 100 #20-30", city: "Bogotá", state: "Cundinamarca", zip: "110111", country: "Colombia" };
export const E2E_BUYER_PASSWORD = "segura12345";

// The catalog is 12 listings per page, newest first, and this suite creates
// dozens of them as it runs — so by the time a later spec file opens
// `/products`, the two seeded listings sit pages deep and a bare
// `goto("/products")` no longer shows them. Filtering by title puts the wanted
// one back on the first page no matter what ran before.
export const catalogSearchUrl = (title: string) =>
  `/products?search=${encodeURIComponent(title)}`;

const hdr = (t?: string) => (t ? { Authorization: `Bearer ${t}` } : undefined);
async function mustOk(r: { ok(): boolean; status(): number; text(): Promise<string> }, msg: string) {
  if (!r.ok()) throw new Error(`${msg}: ${r.status()} ${await r.text()}`);
}

async function login(req: APIRequestContext, c: { email: string; password: string }) {
  const r = await req.post(`${API_URL}/auth/login`, { data: c });
  await mustOk(r, `No se pudo iniciar sesión como ${c.email}`);
  return (await r.json()).access_token as string;
}

export const getToken = (req: APIRequestContext, who: keyof typeof E2E_USERS) => login(req, E2E_USERS[who]);

export async function createPendingProduct(req: APIRequestContext, o: Partial<{ title: string; price: number }> = {}) {
  const t = await getToken(req, "author");
  const title = o.title ?? `Prenda de prueba ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const price = o.price ?? 50000;
  const r = await req.post(`${API_URL}/products`, { headers: hdr(t), data: { title, description: "Prenda creada por la suite e2e para probar la compra.", category: "Chaquetas", size: "M", condition: "Good", price } });
  await mustOk(r, "No se pudo crear el producto de prueba");
  const p = await r.json();
  return { id: p.id as string, title, price };
}

export async function createPurchasableProduct(req: APIRequestContext, o: Partial<{ title: string; price: number }> = {}) {
  const p = await createPendingProduct(req, o);
  const t = await getToken(req, "admin");
  const r = await req.patch(`${API_URL}/products/admin/${p.id}/approve`, { headers: hdr(t), data: {} });
  await mustOk(r, "No se pudo aprobar el producto de prueba");
  return p;
}

export async function createBuyer(req: APIRequestContext) {
  const email = `buyer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.test`;
  const r = await req.post(`${API_URL}/auth/signup`, { data: { email, name: "Comprador E2E", password: E2E_BUYER_PASSWORD, acceptedTerms: true } });
  await mustOk(r, "No se pudo registrar el comprador de prueba");
  return { token: (await r.json()).access_token as string, email, password: E2E_BUYER_PASSWORD };
}

export async function clearCart(req: APIRequestContext, token: string) {
  const r = await req.delete(`${API_URL}/cart`, { headers: hdr(token) });
  await mustOk(r, "No se pudo vaciar el carrito de prueba");
}
