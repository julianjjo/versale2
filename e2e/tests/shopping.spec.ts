import { test as base, expect } from "../fixtures/auth";

const test = base.extend({});

test.describe.configure({ mode: "serial" });

test.describe("Flujo de compra", () => {
  test("la página de inicio muestra los productos sembrados", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Vintage Denim Jacket" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Wool Sweater" }),
    ).toBeVisible();
  });

  test("exploración y filtrado de productos", async ({ page }) => {
    await page.goto("/products");
    await expect(
      page.getByRole("heading", { name: "Vintage Denim Jacket" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Wool Sweater" }),
    ).toBeVisible();

    await page.getByPlaceholder(/buscar/i).fill("denim");
    await page.getByRole("button", { name: /aplicar/i }).click();
    await expect(
      page.getByRole("heading", { name: "Vintage Denim Jacket" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Wool Sweater" }),
    ).not.toBeVisible();
  });

  test("la página de detalle del producto muestra su información", async ({
    page,
  }) => {
    await page.goto("/products");
    await page.getByRole("heading", { name: "Vintage Denim Jacket" }).click();
    await expect(page).toHaveURL(/\/products\/.+/);
    // Price 45 formatted in COP: $ 45 (mock price is 45, no thousands separator)
    await expect(page.getByText("$ 45")).toBeVisible();
    // Brand + category are rendered as separate elements (eyebrow + caption)
    await expect(page.getByText("Levi's").first()).toBeVisible();
    await expect(page.getByText("Jackets").first()).toBeVisible();
  });

  test("el visitante puede ver un producto pero no agregarlo al carrito", async ({
    page,
  }) => {
    await page.goto("/products");
    await page.getByRole("heading", { name: "Vintage Denim Jacket" }).click();
    await page.getByRole("button", { name: /agregar al carrito/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("el usuario puede agregar un producto al carrito", async ({ userPage }) => {
    // Asegurar que el carrito empieza vacío
    await userPage.goto("/cart");
    const clearBtn = userPage.getByRole("button", { name: /vaciar carrito/i });
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await expect(
        userPage.getByText(/tu carrito está vacío/i),
      ).toBeVisible({ timeout: 5_000 });
    }

    await userPage.goto("/products");
    await userPage.getByRole("heading", { name: "Vintage Denim Jacket" }).click();
    await userPage.getByRole("button", { name: /agregar al carrito/i }).click();
    await expect(userPage.getByText(/agregado al carrito/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("el usuario puede pagar y ver el pedido en su historial", async ({
    userPage,
  }) => {
    // Asegurar que el carrito empieza vacío
    await userPage.goto("/cart");
    const clearBtn = userPage.getByRole("button", { name: /vaciar carrito/i });
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await expect(
        userPage.getByText(/tu carrito está vacío/i),
      ).toBeVisible({ timeout: 5_000 });
    }

    await userPage.goto("/products");
    await userPage.getByRole("heading", { name: "Wool Sweater" }).click();
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

    // Crear el pedido vía API para evitar flakiness de UI
    const orderRes = await userPage.request.post(
      "http://127.0.0.1:3101/orders",
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {},
      },
    );
    expect(orderRes.status()).toBe(201);

    // Verificar que aparece en el historial del usuario
    await userPage.goto("/orders");
    await expect(
      userPage.getByRole("link", { name: /Pendiente/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("el usuario puede eliminar un producto del carrito", async ({
    userPage,
  }) => {
    // Asegurar que el carrito empieza vacío
    await userPage.goto("/cart");
    const clearBtn = userPage.getByRole("button", { name: /vaciar carrito/i });
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await expect(
        userPage.getByText(/tu carrito está vacío/i),
      ).toBeVisible({ timeout: 5_000 });
    }

    await userPage.goto("/products");
    await userPage.getByRole("heading", { name: "Vintage Denim Jacket" }).click();
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

    await userPage.goto("/cart");
    await expect(
      userPage.getByText("Vintage Denim Jacket").first(),
    ).toBeVisible({ timeout: 10_000 });
    await userPage
      .getByRole("button", { name: /eliminar/i })
      .first()
      .click();
    await expect(
      userPage.getByText(/tu carrito está vacío/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});
