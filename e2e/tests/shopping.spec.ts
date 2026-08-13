import { test as base, expect } from "../fixtures/auth";
import {
  API_URL,
  E2E_SHIPPING_ADDRESS,
  clearCart,
  createBuyer,
  createPurchasableProduct,
} from "../utils/purchasable";

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
    // Timeout explícito: `/products/[id]` se renderiza en el servidor y, con los
    // archivos de prueba corriendo en paralelo contra `next dev`, la primera
    // visita paga la compilación de la ruta. El presupuesto global de 5 s de
    // `expect` alcanzaba por poco y volvía intermitente una navegación que sí
    // funciona.
    await expect(page).toHaveURL(/\/products\/.+/, { timeout: 15_000 });
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
    // Cada prenda es única: al comprarla queda marcada como vendida y sale del
    // catálogo. Por eso la prueba crea su propio producto en vez de gastar uno
    // de los sembrados, que rompería las demás pruebas y los reintentos de CI.
    const product = await createPurchasableProduct(userPage.request);

    const token = await userPage.evaluate(() =>
      localStorage.getItem("versale_token"),
    );
    await clearCart(userPage.request, token!);

    await userPage.goto(`/products/${product.id}`);
    await userPage.getByRole("button", { name: /agregar al carrito/i }).click();
    await expect(userPage.getByText(/agregado al carrito/i)).toBeVisible({
      timeout: 10_000,
    });

    await expect
      .poll(
        async () => {
          const res = await userPage.request.get(`${API_URL}/cart`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const cart = await res.json();
          return cart.items.length;
        },
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);

    // Crear el pedido vía API para evitar flakiness de UI. La dirección de
    // envío es obligatoria: el API rechaza un pedido sin ella.
    const orderRes = await userPage.request.post(`${API_URL}/orders`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { shippingAddress: E2E_SHIPPING_ADDRESS },
    });
    expect(orderRes.status()).toBe(201);

    // Verificar que aparece en el historial del usuario
    await userPage.goto("/orders");
    await expect(
      userPage.getByRole("link", { name: /Pendiente/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("un pedido sin dirección de envío es rechazado", async ({ page }) => {
    const product = await createPurchasableProduct(page.request);
    const buyer = await createBuyer(page.request);

    await page.request.post(`${API_URL}/cart/items`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
      data: { productId: product.id, quantity: 1 },
    });

    const orderRes = await page.request.post(`${API_URL}/orders`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
      data: {},
    });
    expect(orderRes.status()).toBe(400);
  });

  test("una prenda vendida desaparece del catálogo", async ({ page }) => {
    const product = await createPurchasableProduct(page.request);
    const buyer = await createBuyer(page.request);

    await page.request.post(`${API_URL}/cart/items`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
      data: { productId: product.id, quantity: 1 },
    });
    const orderRes = await page.request.post(`${API_URL}/orders`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
      data: { shippingAddress: E2E_SHIPPING_ADDRESS },
    });
    expect(orderRes.status()).toBe(201);

    // Ya no se puede volver a comprar la misma prenda física.
    const readd = await page.request.post(`${API_URL}/cart/items`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
      data: { productId: product.id, quantity: 1 },
    });
    expect(readd.status()).toBe(400);

    const catalog = await page.request.get(
      `${API_URL}/products?search=${encodeURIComponent(product.title)}`,
    );
    expect((await catalog.json()).meta.total).toBe(0);
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
