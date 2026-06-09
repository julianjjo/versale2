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

test.describe("Autenticación", () => {
  test("muestra los botones de inicio de sesión y registro cuando no hay sesión", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: /iniciar sesión/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /crear cuenta/i }),
    ).toBeVisible();
  });

  test("el registro crea una cuenta e inicia sesión", async ({ page }) => {
    const email = `signup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.test`;
    await page.goto("/signup");

    await page.getByLabel("Nombre").fill("Signup Test");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill("password123");
    // Scope to the form's submit button (avoids matching the header "Crear cuenta" button).
    await page
      .getByRole("main")
      .getByRole("button", { name: /crear cuenta/i })
      .click();

    await page.waitForURL(/\/products/, { timeout: 10_000 });
    await expect(page.getByText("Signup Test")).toBeVisible();
  });

  test("el registro muestra un error si el correo ya existe", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Nombre").fill("Existing");
    await page.getByLabel("Correo electrónico").fill("user@e2e.test");
    await page.getByLabel("Contraseña").fill("password123");
    await page
      .getByRole("main")
      .getByRole("button", { name: /crear cuenta/i })
      .click();

    await expect(
      page.getByText(/ya existe|ya está en uso|no pudimos crear/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("el inicio de sesión autentica al usuario", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill("user@e2e.test");
    await page.getByLabel("Contraseña").fill("user12345");
    await page
      .getByRole("main")
      .getByRole("button", { name: /iniciar sesión/i })
      .click();

    await page.waitForURL(/\/products/, { timeout: 10_000 });
    await expect(page.getByText("E2E User")).toBeVisible();
  });

  test("el inicio de sesión muestra un error con credenciales inválidas", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill("user@e2e.test");
    await page.getByLabel("Contraseña").fill("wrongpassword");
    await page
      .getByRole("main")
      .getByRole("button", { name: /iniciar sesión/i })
      .click();

    await expect(
      page.getByText(/credenciales inválidas|no pudimos iniciar sesión/i),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("cerrar sesión limpia la sesión y vuelve al inicio", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill("user@e2e.test");
    await page.getByLabel("Contraseña").fill("user12345");
    await page
      .getByRole("main")
      .getByRole("button", { name: /iniciar sesión/i })
      .click();
    await page.waitForURL(/\/products/, { timeout: 10_000 });

    await page.getByRole("button", { name: /cerrar sesión/i }).click();
    await page.waitForURL("/", { timeout: 5_000 });
    await expect(
      page.getByRole("button", { name: /iniciar sesión/i }),
    ).toBeVisible();
  });
});
