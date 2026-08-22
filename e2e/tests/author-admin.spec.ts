import { test, expect } from "../fixtures/auth";
import {
  API_URL,
  E2E_SHIPPING_ADDRESS,
  createBuyer,
  createPendingProduct,
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
    // Publicación propia y sin aprobar. La semilla trae una sola pendiente y
    // nadie la repone: aprobarla dejaba la cola vacía, así que un reintento de
    // CI fallaba por falta de fixture en vez de por la regresión real.
    // Además, afirmar sobre ESTA tarjeta (y no sobre un conteo global de
    // botones "Aprobar") la aísla de los productos que las otras specs crean
    // en paralelo.
    const product = await createPendingProduct(adminPage.request);
    const card = adminPage.getByTestId(`admin-product-${product.id}`);

    await adminPage.goto("/products");
    await expect(adminPage.getByText(product.title)).not.toBeVisible();

    await adminPage.goto("/admin");
    await expect(adminPage.getByText(/pedidos totales/i)).toBeVisible();

    await adminPage.goto("/admin/products");
    await expect(card).toBeVisible();
    await expect(card.getByText("Pendiente")).toBeVisible();

    await card.getByRole("button", { name: /aprobar/i }).click();

    await expect(card.getByText("Aprobado")).toBeVisible({ timeout: 5_000 });
    await expect(
      card.getByRole("button", { name: /aprobar/i }),
    ).toHaveCount(0);

    // Aprobada de verdad: ya aparece en el catálogo público.
    await adminPage.goto("/products");
    await expect(adminPage.getByText(product.title)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("cualquier usuario puede publicar un producto nuevo", async ({
    authorPage,
  }) => {
    await authorPage.goto("/sell");
    await authorPage.getByLabel("Título").fill("Test Listing E2E");
    await authorPage
      .getByLabel("Descripción")
      .fill("This is a test listing created by an E2E test.");
    await authorPage.getByLabel("Categoría").selectOption("Otros");
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

  test("el usuario puede editar y luego eliminar su propia reseña", async ({
    userPage,
  }) => {
    // Continúa el escenario de la prueba anterior: mismo producto, misma
    // reseña ya publicada por este mismo usuario sembrado.
    await userPage.goto("/products");
    await userPage
      .getByRole("heading", { name: "Vintage Denim Jacket" })
      .click();
    await expect(
      userPage.getByText("Excellent jacket, fits perfectly!"),
    ).toBeVisible({ timeout: 10_000 });

    await userPage.getByRole("button", { name: /editar reseña/i }).click();
    const commentField = userPage.getByLabel(/comentario/i);
    await expect(commentField).toHaveValue("Excellent jacket, fits perfectly!");
    await commentField.fill("Cambié de opinión, igual está bien.");
    await userPage.getByRole("button", { name: /guardar cambios/i }).click();

    await expect(
      userPage.getByText("Cambié de opinión, igual está bien."),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      userPage.getByText("Excellent jacket, fits perfectly!"),
    ).not.toBeVisible();

    userPage.once("dialog", (dialog) => dialog.accept());
    await userPage.getByRole("button", { name: /eliminar reseña/i }).click();

    await expect(
      userPage.getByText("Cambié de opinión, igual está bien."),
    ).not.toBeVisible({ timeout: 10_000 });
    await expect(
      userPage.getByRole("heading", { name: /escribe una reseña/i }),
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
