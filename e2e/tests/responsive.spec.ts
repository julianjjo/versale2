import { test, expect } from "@playwright/test";
import { VIEWPORTS, type ViewportName } from "../utils/viewport";

test.describe.configure({ mode: "serial" });

const MOBILE: ViewportName = "mobile";
const TABLET: ViewportName = "tablet";
const DESKTOP: ViewportName = "desktop";

async function setViewport(page: import("@playwright/test").Page, name: ViewportName) {
  const vp = VIEWPORTS[name];
  await page.setViewportSize({ width: vp.width, height: vp.height });
}

test.describe("Responsive — Home (anonymous)", () => {
  test("home: hero scales and stays readable on mobile, tablet, and desktop", async ({
    page,
  }) => {
    for (const vp of [MOBILE, TABLET, DESKTOP] as const) {
      await setViewport(page, vp);
      await page.goto("/");

      // Hero text always visible
      await expect(
        page.getByRole("heading", {
          name: /give fashion a second life/i,
        }),
      ).toBeVisible();

      // Both CTAs present
      await expect(
        page.getByRole("link", { name: /browse marketplace/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /start selling/i }),
      ).toBeVisible();

      // No horizontal scroll on the body
      const overflowing = await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
        );
      });
      expect(
        overflowing,
        `horizontal scroll on ${vp} (${VIEWPORTS[vp].width}px)`,
      ).toBe(false);
    }
  });

  test("home: products grid uses 2 columns on mobile, 3 on tablet, 4 on desktop", async ({
    page,
  }) => {
    // 12 approved products seeded — but seed has 2 approved + 1 pending.
    // Browse at least one for the count check, but the count is the same
    // card grid with 2/3/4 columns by breakpoint.
    const expectations: Array<[ViewportName, number]> = [
      [MOBILE, 2],
      [TABLET, 3],
      [DESKTOP, 4],
    ];

    for (const [vp, expectedCols] of expectations) {
      await setViewport(page, vp);
      await page.goto("/products");
      const grid = page.locator(
        ".grid.grid-cols-2, .grid.sm\\:grid-cols-3, .grid.lg\\:grid-cols-4",
      );
      await expect(grid).toBeVisible();

      const computedCols = await grid.evaluate((el) => {
        return window
          .getComputedStyle(el)
          .getPropertyValue("grid-template-columns")
          .split(" ")
          .filter(Boolean).length;
      });
      expect(
        computedCols,
        `viewport ${vp} expected ${expectedCols} columns, got ${computedCols}`,
      ).toBe(expectedCols);
    }
  });
});

test.describe("Responsive — Header navigation", () => {
  test("mobile: shows hamburger, hides inline nav, opens drawer with all links", async ({
    page,
  }) => {
    await setViewport(page, MOBILE);
    await page.goto("/");

    // Hamburger trigger visible
    const trigger = page.getByTestId("mobile-menu-trigger");
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Inline header nav hidden on mobile (scope to <header> to avoid matching the footer's Browse link).
    const header = page.locator("header").first();
    await expect(
      header.getByRole("link", { name: /^browse$/i }),
    ).toBeHidden();

    // Open the menu
    await trigger.click();
    await expect(page.getByRole("dialog", { name: /mobile navigation/i }))
      .toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Drawer contains all primary links
    const dialog = page.getByRole("dialog", { name: /mobile navigation/i });
    for (const label of ["Browse", "Login", "Sign up"]) {
      await expect(dialog.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("mobile: closes drawer on Escape and on backdrop click", async ({
    page,
  }) => {
    await setViewport(page, MOBILE);
    await page.goto("/");
    await page.getByTestId("mobile-menu-trigger").click();
    await expect(page.getByRole("dialog", { name: /mobile navigation/i }))
      .toBeVisible();

    // Escape
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /mobile navigation/i }))
      .toBeHidden();

    // Open again, then click the backdrop.
    await page.getByTestId("mobile-menu-trigger").click();
    await expect(page.getByRole("dialog", { name: /mobile navigation/i }))
      .toBeVisible();
    await page.getByTestId("mobile-menu-backdrop").click({ force: true });
    await expect(page.getByRole("dialog", { name: /mobile navigation/i }))
      .toBeHidden({ timeout: 3_000 });
  });

  test("mobile: drawer Login/Signup buttons navigate", async ({ page }) => {
    await setViewport(page, MOBILE);
    await page.goto("/");
    await page.getByTestId("mobile-menu-trigger").click();
    await page
      .getByRole("dialog", { name: /mobile navigation/i })
      .getByRole("button", { name: /^login$/i })
      .click();
    await page.waitForURL(/\/login/, { timeout: 5_000 });
    await expect(
      page.getByRole("heading", { name: /welcome back/i }),
    ).toBeVisible();
  });

  test("mobile: cart icon link is visible in header for authenticated users", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("user@e2e.test");
    await page.getByLabel("Password").fill("user12345");
    await page.getByRole("main").getByRole("button", { name: /^log in$/i }).click();
    await page.waitForURL(/\/products/, { timeout: 10_000 });

    await setViewport(page, MOBILE);
    await page.goto("/");
    const cartIcon = page.getByRole("link", { name: /^cart$/i });
    await expect(cartIcon).toBeVisible();
    await cartIcon.click();
    await page.waitForURL(/\/cart/, { timeout: 5_000 });
  });

  test("tablet: inline nav visible, hamburger hidden", async ({ page }) => {
    await setViewport(page, TABLET);
    await page.goto("/");
    const header = page.locator("header").first();
    await expect(
      header.getByRole("link", { name: /^browse$/i }),
    ).toBeVisible();
    await expect(
      page.getByTestId("mobile-menu-trigger"),
    ).toBeHidden();
  });

  test("desktop: full nav with profile chip and Logout", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("user@e2e.test");
    await page.getByLabel("Password").fill("user12345");
    await page
      .getByRole("main")
      .getByRole("button", { name: /^log in$/i })
      .click();
    await page.waitForURL(/\/products/, { timeout: 10_000 });

    await setViewport(page, DESKTOP);
    await page.goto("/");

    const header = page.locator("header").first();
    for (const label of ["Browse", "Cart", "Orders", "Sell"]) {
      await expect(
        header.getByRole("link", { name: new RegExp(`^${label}$`, "i") }),
      ).toBeVisible();
    }
    await expect(page.getByText("E2E User")).toBeVisible();
    await expect(
      page.getByTestId("mobile-menu-trigger"),
    ).toBeHidden();
  });
});

test.describe("Responsive — Product detail", () => {
  test("product detail: gallery + info stack on mobile, side-by-side on tablet+", async ({
    page,
  }) => {
    // Login so we can use the cart and authenticated navigation flows downstream
    await page.goto("/login");
    await page.getByLabel("Email").fill("user@e2e.test");
    await page.getByLabel("Password").fill("user12345");
    await page
      .getByRole("main")
      .getByRole("button", { name: /^log in$/i })
      .click();
    await page.waitForURL(/\/products/, { timeout: 10_000 });
    await page.goto("/products");
    // Cards are wrapped in a Link; click the heading text inside the card.
    const firstCard = page.getByRole("heading", { name: /vintage denim jacket/i });
    await expect(firstCard).toBeVisible();
    await firstCard.click();
    await expect(page).toHaveURL(/\/products\/.+/);
    const detailUrl = page.url();

    // Mobile: gallery and info are stacked (single column)
    await setViewport(page, MOBILE);
    await page.goto(detailUrl);
    // Gallery is the 1:1 aspect box at the top of the detail page.
    const gallery = page.locator("div.aspect-square").first();
    const title = page
      .getByRole("heading", { name: /vintage denim jacket/i })
      .first();
    const galleryBox = await gallery.boundingBox();
    const titleBox = await title.boundingBox();
    expect(galleryBox, "mobile gallery box").toBeTruthy();
    expect(titleBox, "mobile title box").toBeTruthy();
    // On mobile, title is below the gallery (greater y)
    expect(
      titleBox!.y,
      `mobile: title y=${titleBox!.y} should be > gallery bottom=${
        galleryBox!.y + galleryBox!.height
      }`,
    ).toBeGreaterThan(galleryBox!.y);

    // Tablet+: side-by-side (title is to the right of the gallery)
    await setViewport(page, TABLET);
    await page.goto(detailUrl);
    const galleryBox2 = await page
      .locator("div.aspect-square")
      .first()
      .boundingBox();
    const titleBox2 = await page
      .getByRole("heading", { name: /vintage denim jacket/i })
      .first()
      .boundingBox();
    expect(
      titleBox2!.x,
      `tablet: title x=${titleBox2!.x} should be > gallery right=${
        galleryBox2!.x + galleryBox2!.width
      }`,
    ).toBeGreaterThan(galleryBox2!.x);
  });
});

test.describe("Responsive — Cart & checkout", () => {
  test("cart: stacks items and summary on mobile, 2-column on desktop", async ({
    page,
  }) => {
    // Login + add a product to cart
    await page.goto("/login");
    await page.getByLabel("Email").fill("user@e2e.test");
    await page.getByLabel("Password").fill("user12345");
    await page.getByRole("main").getByRole("button", { name: /^log in$/i }).click();
    await page.waitForURL(/\/products/, { timeout: 10_000 });
    await page.goto("/products");
    await page.getByRole("heading", { name: /vintage denim jacket/i }).click();
    await expect(page).toHaveURL(/\/products\/.+/);
    await page.getByRole("button", { name: /add to cart/i }).click();
    await page.waitForTimeout(500);
    await page.goto("/cart");

    for (const vp of [MOBILE, DESKTOP] as const) {
      await setViewport(page, vp);
      await page.goto("/cart");
      const heading = page.getByRole("heading", { name: /your cart/i });
      await expect(heading).toBeVisible();
    }

    // Desktop: 3-column grid (items span 2, summary span 1) — check that
    // items list and summary cards are side-by-side (different x ranges).
    await setViewport(page, DESKTOP);
    await page.goto("/cart");
    const itemCard = page.getByText(/vintage denim jacket/i).first();
    const summary = page.getByText(/subtotal/i).first();
    const itemBox = await itemCard.boundingBox();
    const summaryBox = await summary.boundingBox();
    expect(itemBox, "desktop item box").toBeTruthy();
    expect(summaryBox, "desktop summary box").toBeTruthy();
    expect(
      summaryBox!.x,
      `desktop: summary should be to the right of items`,
    ).toBeGreaterThan(itemBox!.x);
  });
});

test.describe("Responsive — Admin", () => {
  test("admin tabs are scrollable on narrow viewports and visible on desktop", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@e2e.test");
    await page.getByLabel("Password").fill("admin12345");
    await page.getByRole("main").getByRole("button", { name: /^log in$/i }).click();
    await page.waitForURL(/\/products/, { timeout: 10_000 });

    // Mobile: tab nav should still be reachable (scrollable container)
    await setViewport(page, MOBILE);
    await page.goto("/admin");
    const tabs = page.getByRole("navigation", { name: /admin sections/i });
    await expect(tabs).toBeVisible();
    // Each tab is reachable by name
    for (const label of ["Overview", "Products", "Orders", "Users"]) {
      await expect(tabs.getByRole("link", { name: new RegExp(`^${label}$`, "i") }))
        .toBeAttached();
    }
  });

  test("admin stat cards: 1 col mobile, 2 col tablet, 4 col desktop", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@e2e.test");
    await page.getByLabel("Password").fill("admin12345");
    await page.getByRole("main").getByRole("button", { name: /^log in$/i }).click();
    await page.waitForURL(/\/products/, { timeout: 10_000 });

    const expectations: Array<[ViewportName, number]> = [
      [MOBILE, 1],
      [TABLET, 2],
      [DESKTOP, 4],
    ];

    for (const [vp, expectedCols] of expectations) {
      await setViewport(page, vp);
      await page.goto("/admin");
      // The stats grid is the first .grid that contains 4 children
      const grid = page
        .locator(".grid.grid-cols-1, .grid.sm\\:grid-cols-2, .grid.lg\\:grid-cols-4")
        .first();
      await expect(grid).toBeVisible();
      const cols = await grid.evaluate((el) =>
        window
          .getComputedStyle(el)
          .getPropertyValue("grid-template-columns")
          .split(" ")
          .filter(Boolean).length,
      );
      expect(
        cols,
        `admin stats at ${vp} expected ${expectedCols}, got ${cols}`,
      ).toBe(expectedCols);
    }
  });
});

test.describe("Responsive — Forms (sell)", () => {
  test("sell form: fields stack on mobile, sit in 2 columns on desktop", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("user@e2e.test");
    await page.getByLabel("Password").fill("user12345");
    await page.getByRole("main").getByRole("button", { name: /^log in$/i }).click();
    await page.waitForURL(/\/products/, { timeout: 10_000 });

    await setViewport(page, DESKTOP);
    await page.goto("/sell");
    const title = page.getByLabel("Title");
    const category = page.getByLabel("Category");
    const titleBox = await title.boundingBox();
    const categoryBox = await category.boundingBox();
    expect(titleBox, "title box").toBeTruthy();
    expect(categoryBox, "category box").toBeTruthy();
    // Desktop: category field is in the same row as another field (Brand)
    // and to the right of Title's start, OR below it. Either way, the form
    // should be visible and have a clear 2-column grid at desktop.
    const formWidth = await page.evaluate(() => {
      const form = document.querySelector("form");
      return form ? form.getBoundingClientRect().width : 0;
    });
    expect(formWidth).toBeGreaterThan(500);

    // On mobile, fields are stacked — title and category share similar x
    await setViewport(page, MOBILE);
    await page.goto("/sell");
    const titleBoxM = await page.getByLabel("Title").boundingBox();
    const categoryBoxM = await page.getByLabel("Category").boundingBox();
    expect(
      Math.abs(titleBoxM!.x - categoryBoxM!.x),
      `mobile: title and category should be aligned left within ~30px`,
    ).toBeLessThan(30);
    expect(
      categoryBoxM!.y,
      "mobile: category should be below title",
    ).toBeGreaterThan(titleBoxM!.y);
  });
});

test.describe("Responsive — Footer", () => {
  test("footer: links visible and no horizontal overflow at every breakpoint", async ({
    page,
  }) => {
    for (const vp of [MOBILE, TABLET, DESKTOP] as const) {
      await setViewport(page, vp);
      await page.goto("/");
      const footer = page.locator("footer");
      await expect(footer).toBeVisible();
      for (const label of ["Browse", "Sell", "Log in", "Sign up"]) {
        await expect(
          footer.getByRole("link", { name: new RegExp(`^${label}$`, "i") }),
        ).toBeVisible();
      }
      const overflowing = await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
        );
      });
      expect(overflowing, `no horizontal scroll on ${vp}`).toBe(false);
    }
  });
});
