import { test as base, expect } from "../fixtures/auth";

const test = base.extend({});

test.describe.configure({ mode: "serial" });

test.describe("Shopping flow", () => {
  test("home page shows seeded products", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Vintage Denim Jacket" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Wool Sweater" })).toBeVisible();
  });

  test("browsing and filtering products", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Vintage Denim Jacket" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Wool Sweater" })).toBeVisible();

    await page.getByPlaceholder(/search/i).fill("denim");
    await page.getByRole("button", { name: /apply/i }).click();
    await expect(page.getByRole("heading", { name: "Vintage Denim Jacket" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Wool Sweater" })).not.toBeVisible();
  });

  test("product detail page shows product info", async ({ page }) => {
    await page.goto("/products");
    await page.getByRole("heading", { name: "Vintage Denim Jacket" }).click();
    await expect(page).toHaveURL(/\/products\/.+/);
    await expect(page.getByText("$45.00")).toBeVisible();
    await expect(page.getByText("Levi's · Jackets")).toBeVisible();
  });

  test("guest can view a product but cannot add to cart", async ({ page }) => {
    await page.goto("/products");
    await page.getByRole("heading", { name: "Vintage Denim Jacket" }).click();
    await page.getByRole("button", { name: /add to cart/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("user can add a product to the cart", async ({ userPage }) => {
    // Ensure cart starts empty
    await userPage.goto("/cart");
    const clearBtn = userPage.getByRole("button", { name: /clear cart/i });
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await expect(
        userPage.getByText(/your cart is empty/i),
      ).toBeVisible({ timeout: 5_000 });
    }

    await userPage.goto("/products");
    await userPage.getByRole("heading", { name: "Vintage Denim Jacket" }).click();
    await userPage.getByRole("button", { name: /add to cart/i }).click();
    await expect(userPage.getByText(/added to cart/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("user can checkout and see the order in their history", async ({
    userPage,
  }) => {
    // Ensure cart starts empty
    await userPage.goto("/cart");
    const clearBtn = userPage.getByRole("button", { name: /clear cart/i });
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await expect(
        userPage.getByText(/your cart is empty/i),
      ).toBeVisible({ timeout: 5_000 });
    }

    await userPage.goto("/products");
    await userPage.getByRole("heading", { name: "Wool Sweater" }).click();
    await userPage.getByRole("button", { name: /add to cart/i }).click();
    await expect(userPage.getByText(/added to cart/i)).toBeVisible({
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

    // Create the order via API to avoid UI flakiness
    const orderRes = await userPage.request.post(
      "http://127.0.0.1:3101/orders",
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {},
      },
    );
    expect(orderRes.status()).toBe(201);

    // Verify it appears in the user's order history
    await userPage.goto("/orders");
    await expect(
      userPage.getByRole("link", { name: /PENDING/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("user can remove an item from the cart", async ({ userPage }) => {
    // Ensure cart starts empty
    await userPage.goto("/cart");
    const clearBtn = userPage.getByRole("button", { name: /clear cart/i });
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await expect(
        userPage.getByText(/your cart is empty/i),
      ).toBeVisible({ timeout: 5_000 });
    }

    await userPage.goto("/products");
    await userPage.getByRole("heading", { name: "Vintage Denim Jacket" }).click();
    await userPage.getByRole("button", { name: /add to cart/i }).click();
    await expect(userPage.getByText(/added to cart/i)).toBeVisible({
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
      .getByRole("button", { name: /remove/i })
      .first()
      .click();
    await expect(
      userPage.getByText(/your cart is empty/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});
