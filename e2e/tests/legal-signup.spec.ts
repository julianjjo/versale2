import { test, expect } from "@playwright/test";

// Item 8: legales y contacto — el footer lleva a las páginas reales (no al
// placeholder de /login) y el signup exige el consentimiento 18+ + términos.

test.describe("Legales y contacto", () => {
  test("el footer navega a Términos y a Privacidad", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("contentinfo").getByRole("link", { name: /términos/i }).click();
    await page.waitForURL(/\/terminos/);
    await expect(
      page.getByRole("heading", { name: /términos y condiciones/i }),
    ).toBeVisible();

    await page.getByRole("contentinfo").getByRole("link", { name: /privacidad/i }).click();
    await page.waitForURL(/\/privacidad/);
    await expect(
      page.getByRole("heading", { name: /política de privacidad/i }),
    ).toBeVisible();
  });

  test("rechaza el registro sin el checkbox de 18+ y términos", async ({
    page,
  }) => {
    await page.goto("/signup");

    await page.getByLabel("Nombre").fill("E2E Menor");
    await page.getByLabel("Correo electrónico").fill(`menor-${Date.now()}@e2e.test`);
    await page.getByLabel("Contraseña").fill("contrasena123");
    // Sin marcar el checkbox de consentimiento.
    await page.getByRole("button", { name: /crear cuenta/i }).click();

    await expect(
      page.getByText(/debes confirmar que eres mayor de 18 años/i),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("el registro procede al marcar el checkbox de 18+ y términos", async ({
    page,
  }) => {
    await page.goto("/signup");

    const email = `legal-${Date.now()}@e2e.test`;
    await page.getByLabel("Nombre").fill("E2E Legal");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill("contrasena123");
    await page.getByLabel(/mayor de 18 años/i).check();
    await page.getByRole("button", { name: /crear cuenta/i }).click();

    await page.waitForURL(/\/products/, { timeout: 10_000 });
  });
});
