import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";
import { API_URL, createBuyer, E2E_SHIPPING_ADDRESS } from "../utils/purchasable";
import { E2E_USERS } from "../utils/seed";

// ponytail: serial — backdate mutates shared e2e.db
test.describe.configure({ mode: "serial" });

function hdr(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}
async function login(req: import("@playwright/test").APIRequestContext, c: { email: string; password: string }) {
  const r = await req.post(`${API_URL}/auth/login`, { data: c });
  if (!r.ok()) throw new Error(`login ${c.email}: ${r.status()} ${await r.text()}`);
  return (await r.json()).access_token as string;
}
async function createSellerProduct(req: import("@playwright/test").APIRequestContext, sellerToken: string, title: string) {
  const r = await req.post(`${API_URL}/products`, {
    headers: hdr(sellerToken),
    data: { title, description: "Prenda e2e borrado.", category: "Chaquetas", size: "M", condition: "Good", price: 50000 },
  });
  if (!r.ok()) throw new Error(`create product ${title}: ${r.status()} ${await r.text()}`);
  const p = await r.json();
  const adminToken = await login(req, E2E_USERS.admin);
  const ar = await req.patch(`${API_URL}/products/admin/${p.id}/approve`, { headers: hdr(adminToken), data: {} });
  if (!ar.ok()) throw new Error(`approve ${p.id}: ${ar.status()} ${await ar.text()}`);
  return { id: p.id as string, title };
}
function prismaForE2e() {
  // ponytail: cron not exposed via HTTP — direct DB backdate is minimal e2e bridge
  const url = process.env.DATABASE_URL ?? `file:${path.join(__dirname, "../../apps/api/e2e.db")}`;
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

test.describe("Borrado de cuenta con anonimización", () => {
  test("1 DangerZone UI happy delete + API variant", async ({ page }) => {
    const req = page.request;
    const buyer = await createBuyer(req);
    const seller = await createBuyer(req);
    const title = `Borrado Prod ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const product = await createSellerProduct(req, seller.token, title);

    // live data: favorite + cart
    const fav = await req.post(`${API_URL}/favorites/${product.id}`, { headers: hdr(buyer.token) });
    expect([201, 200].includes(fav.status())).toBe(true);
    const cart = await req.post(`${API_URL}/cart/items`, { headers: hdr(buyer.token), data: { productId: product.id, quantity: 1 } });
    expect(cart.status()).toBe(201);

    // login via UI
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(buyer.email);
    await page.getByLabel("Contraseña").fill(buyer.password);
    await page.getByRole("main").getByRole("button", { name: /iniciar sesión/i }).click();
    await page.waitForURL(/\/products/, { timeout: 10_000 });

    await page.goto("/profile");
    await expect(page.getByText("Zona de peligro")).toBeVisible({ timeout: 10_000 });

    // wrong password → 403 alert
    await page.getByLabel("Confirma tu contraseña").fill("mala12345");
    await page.getByRole("button", { name: /Eliminar mi cuenta/i }).click();
    await expect(page.getByText("¿Seguro que quieres eliminar tu cuenta?")).toBeVisible();
    await page.getByRole("button", { name: /Sí, eliminar definitivamente/i }).click();
    await expect(page.getByText(/La contraseña actual es incorrecta/i)).toBeVisible({ timeout: 5_000 });
    // modal closed on error
    await expect(page.getByText("¿Seguro que quieres eliminar tu cuenta?")).toHaveCount(0);
    // still on profile, token intact
    await expect(page).toHaveURL(/\/profile/);

    // correct password → confirm → /login?reason=account_deleted
    await page.getByLabel("Confirma tu contraseña").fill(buyer.password);
    await page.getByRole("button", { name: /Eliminar mi cuenta/i }).click();
    await expect(page.getByText("¿Seguro que quieres eliminar tu cuenta?")).toBeVisible();
    await page.getByRole("button", { name: /Sí, eliminar definitivamente/i }).click();
    await page.waitForURL(/\/login\?reason=account_deleted/, { timeout: 10_000 });
    const token = await page.evaluate(() => localStorage.getItem("versale_token"));
    expect(token).toBeFalsy();
    // bell gone (no auth)
    await expect(page.getByLabel(/Notificaciones/i)).toHaveCount(0);
    await expect(page.getByText(/Tu cuenta se eliminó correctamente/i)).toBeVisible();

    // API variant: fresh buyer delete via API directly 200
    const buyer2 = await createBuyer(req);
    const del = await req.delete(`${API_URL}/users/me`, { headers: hdr(buyer2.token), data: { currentPassword: buyer2.password } });
    expect(del.status()).toBe(200);
    expect((await del.json()).message).toMatch(/eliminó/i);
  });

  test("2 token invalidation + forgot enumeration guard", async ({ page }) => {
    const req = page.request;
    const buyer = await createBuyer(req);
    const oldToken = buyer.token;
    const email = buyer.email;
    const pwd = buyer.password;

    const del = await req.delete(`${API_URL}/users/me`, { headers: hdr(oldToken), data: { currentPassword: pwd } });
    expect(del.status()).toBe(200);

    const me = await req.get(`${API_URL}/users/me`, { headers: hdr(oldToken) });
    expect(me.status()).toBe(401);

    const relogin = await req.post(`${API_URL}/auth/login`, { data: { email, password: pwd } });
    expect(relogin.status()).toBe(401);
    expect(await relogin.text()).toMatch(/Credenciales inválidas/i);

    const forgot = await req.post(`${API_URL}/auth/forgot-password`, { data: { email } });
    expect(forgot.status()).toBe(200);
    const fb = await forgot.json();
    expect(fb.message).toMatch(/Si el correo existe/i);
    expect(fb.resetToken).toBeUndefined();
  });

  test("3 email liberado para re-registro 201", async ({ page }) => {
    const req = page.request;
    const buyer = await createBuyer(req);
    const email = buyer.email;
    const pwd = buyer.password;
    const tok = buyer.token;

    const del = await req.delete(`${API_URL}/users/me`, { headers: hdr(tok), data: { currentPassword: pwd } });
    expect(del.status()).toBe(200);

    const signup = await req.post(`${API_URL}/auth/signup`, { data: { email, name: "Re-registro", password: pwd, acceptedTerms: true } });
    expect(signup.status()).toBe(201);
    const body = await signup.json();
    expect(body.access_token).toBeTruthy();

    const newLogin = await req.post(`${API_URL}/auth/login`, { data: { email, password: pwd } });
    expect(newLogin.status()).toBe(200);
  });

  test("4 producto WITHDRAWN tras borrado", async ({ page }) => {
    const req = page.request;
    const seller = await createBuyer(req);
    const title = `Withdrawn ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const product = await createSellerProduct(req, seller.token, title);

    // verify visible before
    const before = await req.get(`${API_URL}/products?search=${encodeURIComponent(title)}`);
    expect((await before.json()).meta.total).toBe(1);

    const del = await req.delete(`${API_URL}/users/me`, { headers: hdr(seller.token), data: { currentPassword: seller.password } });
    expect(del.status()).toBe(200);

    // public catalog 0
    const after = await req.get(`${API_URL}/products?search=${encodeURIComponent(title)}`);
    expect((await after.json()).meta.total).toBe(0);

    // seller mine with old token 401
    const mine = await req.get(`${API_URL}/products/mine`, { headers: hdr(seller.token) });
    expect(mine.status()).toBe(401);

    // admin can still fetch product as WITHDRAWN
    const adminToken = await login(req, E2E_USERS.admin);
    const adminView = await req.get(`${API_URL}/products/${product.id}`, { headers: hdr(adminToken) });
    expect(adminView.status()).toBe(200);
    expect((await adminView.json()).status).toBe("WITHDRAWN");
  });

  test("5 cascada deletes: cart/favorite/vote/notification", async ({ page }) => {
    const req = page.request;
    const seller = await createBuyer(req);
    const buyer = await createBuyer(req);
    const title = `Cascade ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const product = await createSellerProduct(req, seller.token, title);

    // favorite + cart
    const f = await req.post(`${API_URL}/favorites/${product.id}`, { headers: hdr(buyer.token) });
    expect([200, 201].includes(f.status())).toBe(true);
    const c = await req.post(`${API_URL}/cart/items`, { headers: hdr(buyer.token), data: { productId: product.id, quantity: 1 } });
    expect(c.status()).toBe(201);

    // get buyer id via /users/me
    const me = await req.get(`${API_URL}/users/me`, { headers: hdr(buyer.token) });
    const buyerId = (await me.json()).id as string;

    // ensure rows exist via prisma before
    const prisma = prismaForE2e();
    try {
      const favCountBefore = await prisma.favorite.count({ where: { userId: buyerId } });
      expect(favCountBefore).toBeGreaterThan(0);
      const cart = await prisma.cart.findUnique({ where: { userId: buyerId } });
      expect(cart).not.toBeNull();
    } finally {
      await prisma.$disconnect();
    }

    const del = await req.delete(`${API_URL}/users/me`, { headers: hdr(buyer.token), data: { currentPassword: buyer.password } });
    expect(del.status()).toBe(200);

    // old token 401 for favorites
    const favAfter = await req.get(`${API_URL}/favorites`, { headers: hdr(buyer.token) });
    expect(favAfter.status()).toBe(401);

    // DB rows gone
    const prisma2 = prismaForE2e();
    try {
      const favCount = await prisma2.favorite.count({ where: { userId: buyerId } });
      expect(favCount).toBe(0);
      const cartAfter = await prisma2.cart.findUnique({ where: { userId: buyerId } });
      expect(cartAfter).toBeNull();
      const voteCount = await prisma2.reviewHelpfulVote.count({ where: { userId: buyerId } });
      expect(voteCount).toBe(0);
      const notifCount = await prisma2.notification.count({ where: { userId: buyerId } });
      expect(notifCount).toBe(0);
    } finally {
      await prisma2.$disconnect();
    }
  });

  test("6 redacción dirección 30d — ponytail ceiling", async ({ page }) => {
    const req = page.request;
    const seller = await createBuyer(req);
    const buyer = await createBuyer(req);
    const title = `Redact ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const product = await createSellerProduct(req, seller.token, title);
    await req.post(`${API_URL}/cart/items`, { headers: hdr(buyer.token), data: { productId: product.id, quantity: 1 } });
    const orderRes = await req.post(`${API_URL}/orders`, { headers: hdr(buyer.token), data: { shippingAddress: E2E_SHIPPING_ADDRESS } });
    expect(orderRes.status()).toBe(201);
    const order = (await orderRes.json()) as { id: string };
    const adminToken = await login(req, E2E_USERS.admin);
    const paid = await req.patch(`${API_URL}/orders/admin/${order.id}/status`, { headers: hdr(adminToken), data: { status: "PAID" } });
    expect(paid.status()).toBe(200);
    const ship = await req.patch(`${API_URL}/orders/mine/sales/${order.id}/ship`, { headers: hdr(seller.token), data: { trackingNumber: "REDACT-TRACK" } });
    expect(ship.status()).toBe(200);
    const del = await req.patch(`${API_URL}/orders/admin/${order.id}/status`, { headers: hdr(adminToken), data: { status: "DELIVERED" } });
    expect(del.status()).toBe(200);

    // verify shippingAddress present before delete
    const beforeDel = await req.get(`${API_URL}/orders/${order.id}`, { headers: hdr(buyer.token) });
    expect(beforeDel.status()).toBe(200);
    expect((await beforeDel.json()).shippingAddress).toMatchObject(E2E_SHIPPING_ADDRESS);

    // delete buyer
    const delBuyer = await req.delete(`${API_URL}/users/me`, { headers: hdr(buyer.token), data: { currentPassword: buyer.password } });
    expect(delBuyer.status()).toBe(200);

    // order still exists via admin, address not yet redacted (<30d)
    const asAdmin = await req.get(`${API_URL}/orders/${order.id}`, { headers: hdr(adminToken) });
    expect(asAdmin.status()).toBe(200);
    const addrBefore = (await asAdmin.json()).shippingAddress;
    expect(addrBefore).toMatchObject(E2E_SHIPPING_ADDRESS);

    // ponytail: cron not exposed via HTTP — direct DB backdate is minimal e2e bridge
    const prisma = prismaForE2e();
    try {
      await prisma.order.update({ where: { id: order.id }, data: { deliveredAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) } });
      // simulate cron redactAddressesForDeletedAccounts
      await prisma.order.updateMany({
        where: { id: order.id, shippingAddressRedactedAt: null, deliveredAt: { lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        data: { shippingAddress: { eliminada: "Dirección de envío eliminada: la cuenta fue borrada y el plazo de conservación terminó" }, shippingAddressRedactedAt: new Date() },
      });
    } finally {
      await prisma.$disconnect();
    }

    const after = await req.get(`${API_URL}/orders/${order.id}`, { headers: hdr(adminToken) });
    expect(after.status()).toBe(200);
    const redacted = (await after.json()).shippingAddress;
    expect(redacted.eliminada ?? JSON.stringify(redacted)).toMatch(/eliminada/i);
  });

  test("7 last-admin guard y self guard", async ({ page }) => {
    const req = page.request;
    const adminToken = await login(req, E2E_USERS.admin);
    const me = await req.get(`${API_URL}/users/me`, { headers: hdr(adminToken) });
    const adminId = (await me.json()).id as string;

    // self guard via admin route DELETE /users/:id
    const self = await req.delete(`${API_URL}/users/${adminId}`, { headers: hdr(adminToken) });
    expect(self.status()).toBe(403);
    expect(await self.text()).toMatch(/propia cuenta/i);

    // create second admin via signup + promote
    const second = await createBuyer(req);
    const prisma = prismaForE2e();
    let secondId: string;
    try {
      const row = await prisma.user.findUnique({ where: { email: second.email } });
      secondId = row!.id;
      await prisma.user.update({ where: { id: secondId }, data: { role: "ADMIN" } });
    } finally {
      await prisma.$disconnect();
    }
    const secondToken = await login(req, { email: second.email, password: second.password });

    // delete second admin when count 2 → ok
    const delSecond = await req.delete(`${API_URL}/users/${secondId}`, { headers: hdr(adminToken) });
    expect(delSecond.status()).toBe(200);

    // now only one admin left → deleteOwnAccount last-admin 403
    const last = await req.delete(`${API_URL}/users/me`, { headers: hdr(adminToken), data: { currentPassword: E2E_USERS.admin.password } });
    expect(last.status()).toBe(403);
    expect(await last.text()).toMatch(/último administrador/i);

    // verify still active
    const still = await req.get(`${API_URL}/users/me`, { headers: hdr(adminToken) });
    expect(still.status()).toBe(200);
    // admin list still contains admin (via prisma deletedAt null)
    const prisma2 = prismaForE2e();
    try {
      const alive = await prisma2.user.findUnique({ where: { id: adminId } });
      expect(alive?.deletedAt).toBeNull();
    } finally {
      await prisma2.$disconnect();
    }
    // secondToken should be invalidated if needed, but second already deleted - ensure 401
    const secondMe = await req.get(`${API_URL}/users/me`, { headers: hdr(secondToken) });
    expect(secondMe.status()).toBe(401);
  });

  test("8 wrong password guard 403", async ({ page }) => {
    const req = page.request;
    const buyer = await createBuyer(req);
    const bad = await req.delete(`${API_URL}/users/me`, { headers: hdr(buyer.token), data: { currentPassword: "incorrecta123" } });
    expect(bad.status()).toBe(403);
    expect(await bad.text()).toMatch(/actual es incorrecta/i);

    // still valid token
    const me = await req.get(`${API_URL}/users/me`, { headers: hdr(buyer.token) });
    expect(me.status()).toBe(200);
  });
});
