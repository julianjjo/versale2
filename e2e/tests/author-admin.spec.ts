import { test, expect } from "../fixtures/auth";
import {
  API_URL,
  E2E_SHIPPING_ADDRESS,
  createBuyer,
  createPurchasableProduct,
  getToken,
} from "../utils/purchasable";

test.describe.configure({ mode: "serial" });

test.describe("Publicación de productos y administración", () => {
  test("el administrador ve el enlace Admin en el header", async ({
    adminPage,
  }) => {
    await expect(
      adminPage.getByRole("link", { name: /^admin$/i }),
    ).toBeVisible();
  });

  test("el usuario regular no ve el enlace Admin", async ({ userPage }) => {
    await expect(
      userPage.getByRole("link", { name: /^carrito$/i }),
    ).toBeVisible();
    const adminLinkCount = await userPage
      .getByRole("link", { name: /^admin$/i })
      .count();
    expect(adminLinkCount).toBe(0);
  });

  test("el administrador puede aprobar un producto pendiente", async ({
    adminPage,
  }) => {
    await adminPage.goto("/products");
    await expect(
      adminPage.getByText("Cotton T-Shirt"),
    ).not.toBeVisible();

    await adminPage.goto("/admin");
    await expect(
      adminPage.getByText(/pedidos totales/i),
    ).toBeVisible();

    await adminPage.goto("/admin/products");
    await expect(adminPage.getByText("Cotton T-Shirt")).toBeVisible();
    await expect(
      adminPage.locator("text=Pendiente").first(),
    ).toBeVisible();

    // Sin `if`: la prueba tiene que fallar si no hay nada que aprobar. Con el
    // condicional anterior pasaba sin verificar nada cuando no encontraba el
    // botón, que es justo el caso que debería delatar una regresión.
    const approveButtons = adminPage.getByRole("button", { name: /aprobar/i });
    const initialCount = await approveButtons.count();
    expect(initialCount).toBeGreaterThan(0);

    await approveButtons.first().click();
    await expect(
      adminPage.getByRole("button", { name: /aprobar/i }),
    ).toHaveCount(initialCount - 1, { timeout: 5_000 });
  });

  test("cualquier usuario puede publicar un producto nuevo", async ({
    authorPage,
  }) => {
    await authorPage.goto("/sell");
    await authorPage.getByLabel("Título").fill("Test Listing E2E");
    await authorPage
      .getByLabel("Descripción")
      .fill("This is a test listing created by an E2E test.");
    await authorPage.getByLabel("Categoría").fill("Test");
    await authorPage.getByLabel("Talla").selectOption("M");
    await authorPage.getByLabel("Condición").selectOption("Good");
    await authorPage.getByLabel(/precio/i).fill("19990");

    await authorPage
      .getByRole("button", { name: /publicar producto/i })
      .click();
    await expect(authorPage).toHaveURL(/\/products/);
  });

  test("el usuario puede dejar una reseña en un producto", async ({
    userPage,
  }) => {
    await userPage.goto("/products");
    await userPage
      .getByRole("heading", { name: "Vintage Denim Jacket" })
      .click();
    await expect(
      userPage.getByRole("heading", { name: "Vintage Denim Jacket" }),
    ).toBeVisible();

    const commentField = userPage.getByLabel(/comentario/i);
    await expect(commentField).toBeVisible({ timeout: 5_000 });
    await commentField.fill("Excellent jacket, fits perfectly!");
    await userPage
      .getByRole("button", { name: /publicar reseña/i })
      .click();

    await expect(
      userPage.getByText("Excellent jacket, fits perfectly!"),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("el administrador puede cambiar el estado de un pedido", async ({
    adminPage,
    userPage,
  }) => {
    // Comprador y prenda propios: esta prueba es sobre el admin cambiando el
    // estado, y usar la cuenta sembrada compartiría carrito con shopping.spec,
    // que corre en paralelo.
    const product = await createPurchasableProduct(adminPage.request);
    const buyer = await createBuyer(adminPage.request);

    await adminPage.request.post(`${API_URL}/cart/items`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
      data: { productId: product.id, quantity: 1 },
    });

    const orderRes = await adminPage.request.post(`${API_URL}/orders`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
      data: { shippingAddress: E2E_SHIPPING_ADDRESS },
    });
    expect(orderRes.status()).toBe(201);
    const order = await orderRes.json();

    // El pedido nace en PENDING y el ciclo de vida solo permite avanzar un
    // paso: PENDING -> PAID. Saltar directo a SHIPPED ahora se rechaza.
    await adminPage.goto("/admin/orders");
    const orderRow = adminPage
      .locator("a", { hasText: `Pedido #${order.id.slice(0, 8)}` })
      .first()
      .locator("..")
      .locator("..");
    const select = orderRow.locator("select");
    await select.selectOption("PAID");
    await expect(orderRow.locator("select")).toHaveValue("PAID");
  });

  test("el administrador no puede devolver un pedido a un estado anterior", async ({
    adminPage,
  }) => {
    const product = await createPurchasableProduct(adminPage.request);
    const buyer = await createBuyer(adminPage.request);

    await adminPage.request.post(`${API_URL}/cart/items`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
      data: { productId: product.id, quantity: 1 },
    });
    const orderRes = await adminPage.request.post(`${API_URL}/orders`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
      data: { shippingAddress: E2E_SHIPPING_ADDRESS },
    });
    expect(orderRes.status()).toBe(201);
    const order = await orderRes.json();

    const adminToken = await getToken(adminPage.request, "admin");
    const forward = await adminPage.request.patch(
      `${API_URL}/orders/admin/${order.id}/status`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { status: "PAID" },
      },
    );
    expect(forward.status()).toBe(200);

    const backwards = await adminPage.request.patch(
      `${API_URL}/orders/admin/${order.id}/status`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { status: "PENDING" },
      },
    );
    expect(backwards.status()).toBe(400);
  });
});
