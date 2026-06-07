import { test as base, expect } from "@playwright/test";

const test = base.extend<{ cleanup: void }>({
  cleanup: [
    async ({ page }, use) => {
      await use();
      await page.context().clearCookies();
    },
    { auto: true, scope: "test" },
  ],
});

test.describe("Authentication", () => {
  test("shows the login page when not authenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^login$/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /sign up/i }),
    ).toBeVisible();
  });

  test("signup form creates a new account and logs in", async ({ page }) => {
    const email = `signup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.test`;
    await page.goto("/signup");

    await page.getByLabel("Name").fill("Signup Test");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /sign up/i }).click();

    await page.waitForURL(/\/products/, { timeout: 10_000 });
    await expect(page.getByText("Signup Test")).toBeVisible();
  });

  test("signup form shows an alert for an existing email", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Name").fill("Existing");
    await page.getByLabel("Email").fill("user@e2e.test");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /sign up/i }).click();

    await expect(
      page.getByText(/already exists|signup failed|user already/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("login form authenticates a user", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("user@e2e.test");
    await page.getByLabel("Password").fill("user12345");
    await page.getByRole("button", { name: /^log in$/i }).click();

    await page.waitForURL(/\/products/, { timeout: 10_000 });
    await expect(page.getByText("E2E User")).toBeVisible();
  });

  test("login shows an error for wrong credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("user@e2e.test");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: /^log in$/i }).click();

    await expect(
      page.getByText(/invalid credentials|login failed/i),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("logout clears the session and returns to home", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("user@e2e.test");
    await page.getByLabel("Password").fill("user12345");
    await page.getByRole("button", { name: /^log in$/i }).click();
    await page.waitForURL(/\/products/, { timeout: 10_000 });

    await page.getByRole("button", { name: /logout/i }).click();
    await page.waitForURL("/", { timeout: 5_000 });
    await expect(page.getByRole("link", { name: /^login$/i })).toBeVisible();
  });
});
