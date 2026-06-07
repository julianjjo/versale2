import { test, expect } from "../fixtures/auth";

test.describe.configure({ mode: "serial" });
import { E2E_USERS } from "../utils/seed";

test.describe("Seller and admin flows", () => {
  test("admin sees the admin link in the header", async ({ adminPage }) => {
    await expect(adminPage.getByRole("link", { name: /^admin$/i })).toBeVisible();
  });

  test("regular user does not see the admin link", async ({ userPage }) => {
    await expect(userPage.getByRole("link", { name: /^cart$/i })).toBeVisible();
    const adminLinkCount = await userPage
      .getByRole("link", { name: /^admin$/i })
      .count();
    expect(adminLinkCount).toBe(0);
  });

  test("admin can approve a pending product", async ({ adminPage }) => {
    await adminPage.goto("/products");
    await expect(
      adminPage.getByText("Cotton T-Shirt"),
    ).not.toBeVisible();

    await adminPage.goto("/admin");
    await expect(adminPage.getByText(/total orders/i)).toBeVisible();

    await adminPage.goto("/admin/products");
    await expect(adminPage.getByText("Cotton T-Shirt")).toBeVisible();
    await expect(
      adminPage.locator("text=Pending").first(),
    ).toBeVisible();

    const approveButtons = adminPage.getByRole("button", { name: /approve/i });
    const initialCount = await approveButtons.count();
    if (initialCount > 0) {
      await approveButtons.first().click();
      await expect(
        adminPage.getByRole("button", { name: /approve/i }),
      ).toHaveCount(initialCount - 1, { timeout: 5_000 });
    }
  });

  test("seller can list a new product", async ({ sellerPage }) => {
    await sellerPage.goto("/sell");
    await sellerPage.getByLabel("Title").fill("Test Listing E2E");
    await sellerPage
      .getByLabel("Description")
      .fill("This is a test listing created by an E2E test.");
    await sellerPage.getByLabel("Category").fill("Test");
    await sellerPage.getByLabel("Size").selectOption("M");
    await sellerPage.getByLabel("Condition").selectOption("Good");
    await sellerPage.getByLabel(/price/i).fill("19.99");

    await sellerPage.getByRole("button", { name: /submit listing/i }).click();
    await expect(sellerPage).toHaveURL(/\/products/);
  });

  test("user can post a review on a product", async ({ userPage }) => {
    await userPage.goto("/products");
    await userPage
      .getByRole("heading", { name: "Vintage Denim Jacket" })
      .click();
    await expect(
      userPage.getByRole("heading", { name: "Vintage Denim Jacket" }),
    ).toBeVisible();

    const commentField = userPage.getByLabel(/comment/i);
    await expect(commentField).toBeVisible({ timeout: 5_000 });
    await commentField.fill("Excellent jacket, fits perfectly!");
    await userPage.getByRole("button", { name: /post review/i }).click();

    await expect(
      userPage.getByText("Excellent jacket, fits perfectly!"),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("admin can change an order status", async ({ adminPage, userPage }) => {
    // Ensure user cart starts empty
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

    // Create the order via API directly to avoid UI flakiness
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
      .locator("a", { hasText: "Order #" })
      .first()
      .locator("..")
      .locator("..");
    const select = orderRow.locator("select");
    await select.selectOption("SHIPPED");
    await expect(orderRow.locator("select")).toHaveValue("SHIPPED");
  });
});
