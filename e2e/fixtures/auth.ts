import { test as base, expect, type Page } from "@playwright/test";
import { E2E_USERS } from "../utils/seed";

type Credentials = (typeof E2E_USERS)[keyof typeof E2E_USERS];

export type AuthenticatedUser = "user" | "admin" | "seller";

async function loginAs(page: Page, credentials: Credentials) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(credentials.email);
  await page.getByLabel("Contraseña").fill(credentials.password);
  // Scope to the form's submit button to avoid matching the header button.
  await page
    .getByRole("main")
    .getByRole("button", { name: /iniciar sesión/i })
    .click();
  await page.waitForURL(/\/products/, { timeout: 10_000 });
}

export const test = base.extend<{
  userPage: Page;
  adminPage: Page;
  sellerPage: Page;
}>({
  userPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, E2E_USERS.user);
    await use(page);
    await ctx.close();
  },
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, E2E_USERS.admin);
    await use(page);
    await ctx.close();
  },
  sellerPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, E2E_USERS.seller);
    await use(page);
    await ctx.close();
  },
});

export { expect };
