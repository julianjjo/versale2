import { test, expect } from "../fixtures/auth";

test.describe.configure({ mode: "serial" });
import { E2E_USERS } from "../utils/seed";

test.describe("Flujos de vendedor y administrador", () => {
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

    const approveButtons = adminPage.getByRole("button", { name: /aprobar/i });
    const initialCount = await approveButtons.count();
    if (initialCount > 0) {
      await approveButtons.first().click();
      await expect(
        adminPage.getByRole("button", { name: /aprobar/i }),
      ).toHaveCount(initialCount - 1, { timeout: 5_000 });
    }
  });

  test("el vendedor puede publicar un producto nuevo", async ({ sellerPage }) => {
    await sellerPage.goto("/sell");
    await sellerPage.getByLabel("Título").fill("Test Listing E2E");
    await sellerPage
      .getByLabel("Descripción")
      .fill("This is a test listing created by an E2E test.");
    await sellerPage.getByLabel("Categoría").fill("Test");
    await sellerPage.getByLabel("Talla").selectOption("M");
    await sellerPage.getByLabel("Condición").selectOption("Good");
    await sellerPage.getByLabel(/precio/i).fill("19990");

    await sellerPage
      .getByRole("button", { name: /publicar producto/i })
      .click();
    await expect(sellerPage).toHaveURL(/\/products/);
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
    // Asegurar que el carrito del usuario empieza vacío
    await userPage.goto("/cart");
    const clearBtn = userPage.getByRole("button", { name: /vaciar carrito/i });
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await expect(
        userPage.getByText(/tu carrito está vacío/i),
      ).toBeVisible({ timeout: 5_000 });
    }

    await userPage.goto("/products");
    await userPage
      .getByRole("heading", { name: "Vintage Denim Jacket" })
      .click();
    await userPage.getByRole("button", { name: /agregar al carrito/i }).click();
    await expect(userPage.getByText(/agregado al carrito/i)).toBeVisible({
      timeout: 10_000,
    });

    const token = await userPage.evaluate(() =>
      localStorage.getItem("versale_token"),
    );
    await expect
      .poll(
        async () => {
          const res = await userPage.request.get(
            "http://127.0.0.1:3101/cart",
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          const cart = await res.json();
          return cart.items.length;
        },
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);

    // Crear el pedido vía API directamente para evitar flakiness de UI
    const orderRes = await userPage.request.post(
      "http://127.0.0.1:3101/orders",
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {},
      },
    );
    expect(orderRes.status()).toBe(201);

    await adminPage.goto("/admin/orders");
    const orderRow = adminPage
      .locator("a", { hasText: "Pedido #" })
      .first()
      .locator("..")
      .locator("..");
    const select = orderRow.locator("select");
    await select.selectOption("SHIPPED");
    await expect(orderRow.locator("select")).toHaveValue("SHIPPED");
  });
});
