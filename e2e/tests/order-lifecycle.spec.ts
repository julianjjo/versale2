import { test, expect } from "@playwright/test";
import {
  API_URL,
  E2E_SHIPPING_ADDRESS,
  createBuyer,
} from "../utils/purchasable";
import { E2E_USERS } from "../utils/seed";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
// ponytail: path not needed — URL is fixed relative to repo root for e2e webServer env

test.describe.configure({ mode: "serial" });

const DISPUTE_PHOTO = "https://localhost/e2e-dispute.jpg";
const DISPUTE_REASON =
  "El producto llegó con una mancha grande y el cierre roto, no coincide con la descripción publicada.";

function hdr(t?: string) {
  return t ? { Authorization: `Bearer ${t}` } : undefined;
}

async function login(
  req: import("@playwright/test").APIRequestContext,
  c: { email: string; password: string },
) {
  const r = await req.post(`${API_URL}/auth/login`, { data: c });
  if (!r.ok()) throw new Error(`login ${c.email}: ${r.status()} ${await r.text()}`);
  return (await r.json()).access_token as string;
}

async function createSellerProduct(
  req: import("@playwright/test").APIRequestContext,
  sellerToken: string,
  title: string,
) {
  const r = await req.post(`${API_URL}/products`, {
    headers: hdr(sellerToken),
    data: {
      title,
      description: "Prenda creada por e2e order-lifecycle.",
      category: "Chaquetas",
      size: "M",
      condition: "Good",
      price: 50000,
    },
  });
  if (!r.ok()) throw new Error(`create product ${title}: ${r.status()} ${await r.text()}`);
  const p = await r.json();
  const adminToken = await login(req, E2E_USERS.admin);
  const ar = await req.patch(`${API_URL}/products/admin/${p.id}/approve`, {
    headers: hdr(adminToken),
    data: {},
  });
  if (!ar.ok()) throw new Error(`approve ${p.id}: ${ar.status()} ${await ar.text()}`);
  return { id: p.id as string, title };
}

async function addToCart(
  req: import("@playwright/test").APIRequestContext,
  buyerToken: string,
  productId: string,
) {
  const r = await req.post(`${API_URL}/cart/items`, {
    headers: hdr(buyerToken),
    data: { productId, quantity: 1 },
  });
  if (!r.ok()) throw new Error(`addToCart ${productId}: ${r.status()} ${await r.text()}`);
}

async function createOrder(
  req: import("@playwright/test").APIRequestContext,
  buyerToken: string,
) {
  const r = await req.post(`${API_URL}/orders`, {
    headers: hdr(buyerToken),
    data: { shippingAddress: E2E_SHIPPING_ADDRESS },
  });
  if (!r.ok()) throw new Error(`createOrder: ${r.status()} ${await r.text()}`);
  return (await r.json()) as { id: string; status: string };
}

function prismaForE2e() {
  // ponytail: cron not exposed via HTTP — direct DB backdate is the minimal e2e bridge
  // DATABASE_URL is set to file:apps/api/e2e.db by playwright webServer env
  const url =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((globalThis as any).process?.env?.DATABASE_URL as string | undefined) ??
    "file:./apps/api/e2e.db";
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

test.describe("Ciclo de vida P1: pedidos, envíos, disputas y crons", () => {
  test("happy path PENDING→PAID→SHIPPED→DELIVERED→DISPUTED→REFUNDED relista AVAILABLE", async ({
    page,
  }) => {
    const req = page.request;
    const seller = await createBuyer(req);
    const sellerToken = seller.token;
    const buyer = await createBuyer(req);
    const adminToken = await login(req, E2E_USERS.admin);

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const product = await createSellerProduct(req, sellerToken, `P1 Happy ${suffix}`);

    await addToCart(req, buyer.token, product.id);
    const order = await createOrder(req, buyer.token);
    expect(order.status).toBe("PENDING");

    // admin PENDING→PAID
    const paidRes = await req.patch(`${API_URL}/orders/admin/${order.id}/status`, {
      headers: hdr(adminToken),
      data: { status: "PAID" },
    });
    expect(paidRes.status()).toBe(200);
    expect((await paidRes.json()).status).toBe("PAID");

    // seller shipOwnSale con tracking
    const tracking = `TRACK-${suffix}`;
    const shipRes = await req.patch(`${API_URL}/orders/mine/sales/${order.id}/ship`, {
      headers: hdr(sellerToken),
      data: { trackingNumber: tracking },
    });
    expect(shipRes.status()).toBe(200);
    const shipped = await shipRes.json();
    expect(shipped.status).toBe("SHIPPED");
    expect(shipped.trackingNumber).toBe(tracking);

    // ORDER_SHIPPED notificación al comprador
    const notifRes = await req.get(`${API_URL}/notifications`, { headers: hdr(buyer.token) });
    expect(notifRes.status()).toBe(200);
    const notifs = (await notifRes.json()).data as Array<{ type: string; orderId: string }>;
    expect(notifs.some((n) => n.type === "ORDER_SHIPPED" && n.orderId === order.id)).toBe(true);

    // admin SHIPPED→DELIVERED
    const delRes = await req.patch(`${API_URL}/orders/admin/${order.id}/status`, {
      headers: hdr(adminToken),
      data: { status: "DELIVERED" },
    });
    expect(delRes.status()).toBe(200);
    expect((await delRes.json()).status).toBe("DELIVERED");

    // buyer abre disputa dentro de 48h con fotos obligatorias
    const dispRes = await req.post(`${API_URL}/orders/${order.id}/dispute`, {
      headers: hdr(buyer.token),
      data: { reason: DISPUTE_REASON, photos: [DISPUTE_PHOTO] },
    });
    expect(dispRes.status()).toBe(201);
    expect((await dispRes.json()).status).toBe("DISPUTED");

    // duplicada → 409 una sola por orden
    const dup = await req.post(`${API_URL}/orders/${order.id}/dispute`, {
      headers: hdr(buyer.token),
      data: { reason: DISPUTE_REASON, photos: [DISPUTE_PHOTO] },
    });
    expect(dup.status()).toBe(409);

    // admin DISPUTED→REFUNDED relista AVAILABLE
    const refRes = await req.patch(`${API_URL}/orders/admin/${order.id}/status`, {
      headers: hdr(adminToken),
      data: { status: "REFUNDED" },
    });
    expect(refRes.status()).toBe(200);
    expect((await refRes.json()).status).toBe("REFUNDED");

    const catalog = await req.get(
      `${API_URL}/products?search=${encodeURIComponent(product.title)}`,
    );
    expect((await catalog.json()).meta.total).toBe(1);
  });

  test("variante DISPUTED→DELIVERED (rechazo de disputa)", async ({ page }) => {
    const req = page.request;
    const seller = await createBuyer(req);
    const buyer = await createBuyer(req);
    const adminToken = await login(req, E2E_USERS.admin);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const product = await createSellerProduct(req, seller.token, `P1 Reject ${suffix}`);
    await addToCart(req, buyer.token, product.id);
    const order = await createOrder(req, buyer.token);
    await req.patch(`${API_URL}/orders/admin/${order.id}/status`, {
      headers: hdr(adminToken),
      data: { status: "PAID" },
    });
    const ship = await req.patch(`${API_URL}/orders/mine/sales/${order.id}/ship`, {
      headers: hdr(seller.token),
      data: { trackingNumber: `TRACK2-${suffix}` },
    });
    expect(ship.status()).toBe(200);
    await req.patch(`${API_URL}/orders/admin/${order.id}/status`, {
      headers: hdr(adminToken),
      data: { status: "DELIVERED" },
    });
    const disp = await req.post(`${API_URL}/orders/${order.id}/dispute`, {
      headers: hdr(buyer.token),
      data: { reason: DISPUTE_REASON, photos: [DISPUTE_PHOTO] },
    });
    expect(disp.status()).toBe(201);

    const back = await req.patch(`${API_URL}/orders/admin/${order.id}/status`, {
      headers: hdr(adminToken),
      data: { status: "DELIVERED" },
    });
    expect(back.status()).toBe(200);
    expect((await back.json()).status).toBe("DELIVERED");

    // ya no se puede re-disputar: 409 histórico sellado
    const dup2 = await req.post(`${API_URL}/orders/${order.id}/dispute`, {
      headers: hdr(buyer.token),
      data: { reason: DISPUTE_REASON, photos: [DISPUTE_PHOTO] },
    });
    expect(dup2.status()).toBe(409);
  });

  test("mis-ventas: cola del vendedor visible tras PAID", async ({ page }) => {
    const req = page.request;
    const seller = await createBuyer(req);
    const buyer = await createBuyer(req);
    const adminToken = await login(req, E2E_USERS.admin);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const product = await createSellerProduct(req, seller.token, `P1 Sales ${suffix}`);
    await addToCart(req, buyer.token, product.id);
    const order = await createOrder(req, buyer.token);
    await req.patch(`${API_URL}/orders/admin/${order.id}/status`, {
      headers: hdr(adminToken),
      data: { status: "PAID" },
    });
    const salesRes = await req.get(`${API_URL}/orders/mine/sales`, {
      headers: hdr(seller.token),
    });
    expect(salesRes.status()).toBe(200);
    const body = await salesRes.json();
    const ids: string[] = body.data.map((o: { id: string }) => o.id);
    expect(ids).toContain(order.id);
  });

  test("guardas: ship mixto 403 y transiciones ilegales", async ({ page }) => {
    const req = page.request;
    const sellerA = await createBuyer(req);
    const sellerB = await createBuyer(req);
    const buyer = await createBuyer(req);
    const adminToken = await login(req, E2E_USERS.admin);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const prodA = await createSellerProduct(req, sellerA.token, `P1 Mix A ${suffix}`);
    const prodB = await createSellerProduct(req, sellerB.token, `P1 Mix B ${suffix}`);
    await addToCart(req, buyer.token, prodA.id);
    await addToCart(req, buyer.token, prodB.id);
    const order = await createOrder(req, buyer.token);
    const paid = await req.patch(`${API_URL}/orders/admin/${order.id}/status`, {
      headers: hdr(adminToken),
      data: { status: "PAID" },
    });
    expect(paid.status()).toBe(200);

    // ningún vendedor individual puede ship mixto → 403
    const shipA = await req.patch(`${API_URL}/orders/mine/sales/${order.id}/ship`, {
      headers: hdr(sellerA.token),
      data: { trackingNumber: "MIX-TRACK" },
    });
    expect(shipA.status()).toBe(403);
    const shipB = await req.patch(`${API_URL}/orders/mine/sales/${order.id}/ship`, {
      headers: hdr(sellerB.token),
      data: { trackingNumber: "MIX-TRACK" },
    });
    expect(shipB.status()).toBe(403);

    // admin sí puede SHIPPED en mixto (fallback 2.3)
    const adminShip = await req.patch(`${API_URL}/orders/admin/${order.id}/status`, {
      headers: hdr(adminToken),
      data: { status: "SHIPPED" },
    });
    expect(adminShip.status()).toBe(200);

    // admin no puede marcar SHIPPED en pedido de un solo vendedor → 403
    const sellerC = await createBuyer(req);
    const prodC = await createSellerProduct(req, sellerC.token, `P1 Single ${suffix}`);
    const buyer2 = await createBuyer(req);
    await addToCart(req, buyer2.token, prodC.id);
    const order2 = await createOrder(req, buyer2.token);
    await req.patch(`${API_URL}/orders/admin/${order2.id}/status`, {
      headers: hdr(adminToken),
      data: { status: "PAID" },
    });
    const adminShipSingle = await req.patch(`${API_URL}/orders/admin/${order2.id}/status`, {
      headers: hdr(adminToken),
      data: { status: "SHIPPED" },
    });
    expect(adminShipSingle.status()).toBe(403);
  });

  test("guardas de disputa: sin fotos 400, motivo corto 400, ventana 48h 400, y solo una por orden 409", async ({
    page,
  }) => {
    const req = page.request;
    const seller = await createBuyer(req);
    const buyer = await createBuyer(req);
    const adminToken = await login(req, E2E_USERS.admin);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const product = await createSellerProduct(req, seller.token, `P1 Disp ${suffix}`);
    await addToCart(req, buyer.token, product.id);
    const order = await createOrder(req, buyer.token);
    await req.patch(`${API_URL}/orders/admin/${order.id}/status`, {
      headers: hdr(adminToken),
      data: { status: "PAID" },
    });
    await req.patch(`${API_URL}/orders/mine/sales/${order.id}/ship`, {
      headers: hdr(seller.token),
      data: {},
    });
    await req.patch(`${API_URL}/orders/admin/${order.id}/status`, {
      headers: hdr(adminToken),
      data: { status: "DELIVERED" },
    });

    // sin fotos → 400
    const noPhoto = await req.post(`${API_URL}/orders/${order.id}/dispute`, {
      headers: hdr(buyer.token),
      data: { reason: DISPUTE_REASON, photos: [] },
    });
    expect(noPhoto.status()).toBe(400);

    // fotos vacías por DTO también 400 (missing)
    const noPhotosField = await req.post(`${API_URL}/orders/${order.id}/dispute`, {
      headers: hdr(buyer.token),
      data: { reason: DISPUTE_REASON },
    });
    expect(noPhotosField.status()).toBe(400);

    // motivo muy corto → 400
    const shortReason = await req.post(`${API_URL}/orders/${order.id}/dispute`, {
      headers: hdr(buyer.token),
      data: { reason: "muy corto", photos: [DISPUTE_PHOTO] },
    });
    expect(shortReason.status()).toBe(400);

    // simular ventana vencida: backdate deliveredAt 3 días atrás vía Prisma
    // ponytail: cron no expuesto por HTTP — backdate directo a DB y verifica estado vía GET
    const prisma = prismaForE2e();
    await prisma.order.update({
      where: { id: order.id },
      data: { deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    });
    await prisma.$disconnect();
    const late = await req.post(`${API_URL}/orders/${order.id}/dispute`, {
      headers: hdr(buyer.token),
      data: { reason: DISPUTE_REASON, photos: [DISPUTE_PHOTO] },
    });
    expect(late.status()).toBe(400);
  });

  test("cron sweep pragmático: backdate paidAt 8d y disputeExpiresAt pasado — documenta ponytail: no HTTP trigger", async ({
    page,
  }) => {
    const req = page.request;
    const seller = await createBuyer(req);
    const buyer = await createBuyer(req);
    const adminToken = await login(req, E2E_USERS.admin);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const product = await createSellerProduct(req, seller.token, `P1 Cron ${suffix}`);
    await addToCart(req, buyer.token, product.id);
    const order = await createOrder(req, buyer.token);
    await req.patch(`${API_URL}/orders/admin/${order.id}/status`, {
      headers: hdr(adminToken),
      data: { status: "PAID" },
    });
    await req.patch(`${API_URL}/orders/mine/sales/${order.id}/ship`, {
      headers: hdr(seller.token),
      data: { trackingNumber: "CRON-TRACK" },
    });
    await req.patch(`${API_URL}/orders/admin/${order.id}/status`, {
      headers: hdr(adminToken),
      data: { status: "DELIVERED" },
    });
    const disp = await req.post(`${API_URL}/orders/${order.id}/dispute`, {
      headers: hdr(buyer.token),
      data: { reason: DISPUTE_REASON, photos: [DISPUTE_PHOTO] },
    });
    expect(disp.status()).toBe(201);

    // backdate disputeExpiresAt al pasado y paidAt de otro pedido simulado
    // — los sweeps corren hourly en el servidor (OrdersService#runOrderDeadlineSweeps)
    // pero no hay endpoint HTTP para dispararlos en test. Se verifica que los
    // campos quedaron backdateados y que sin sweep el estado aún es DISPUTED;
    // con sweep se movería a REFUNDED y relistaría (ver test feliz).
    // ponytail: si hace falta testear autoRefund/autoResolve por HTTP, exponer POST /orders/admin/debug/run-sweeps solo en NODE_ENV=test.
    const prisma = prismaForE2e();
    await prisma.order.update({
      where: { id: order.id },
      data: {
        disputeExpiresAt: new Date(Date.now() - 60 * 1000),
      },
    });
    // otro pedido PAID hace 8 días para futuro autoRefundUnshippedPaidOrders
    const seller2 = await createBuyer(req);
    const prod2 = await createSellerProduct(req, seller2.token, `P1 Cron PAID ${suffix}`);
    const buyer2 = await createBuyer(req);
    await addToCart(req, buyer2.token, prod2.id);
    const orderPaid = await createOrder(req, buyer2.token);
    await req.patch(`${API_URL}/orders/admin/${orderPaid.id}/status`, {
      headers: hdr(adminToken),
      data: { status: "PAID" },
    });
    await prisma.order.update({
      where: { id: orderPaid.id },
      data: { paidAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    });
    await prisma.$disconnect();

    // verificar que sin sweep siguen en su estado
    const stillDisputed = await req.get(`${API_URL}/orders/${order.id}`, {
      headers: hdr(buyer.token),
    });
    expect(stillDisputed.status()).toBe(200);
    expect((await stillDisputed.json()).status).toBe("DISPUTED");

    const stillPaid = await req.get(`${API_URL}/orders/${orderPaid.id}`, {
      headers: hdr(buyer2.token),
    });
    expect(stillPaid.status()).toBe(200);
    expect((await stillPaid.json()).status).toBe("PAID");

    // no se puede disparar cron por HTTP; el backdate queda como evidencia
    // de que el sweep los encontraría (where paidAt <= now-7d, disputeExpiresAt <= now)
  });
});
