import { test as base, expect, type Page } from "@playwright/test";
import { E2E_USERS } from "../utils/seed";

type Credentials = (typeof E2E_USERS)[keyof typeof E2E_USERS];

export type AuthenticatedUser = "user" | "admin" | "author";

async function loginAs(page: Page, credentials: Credentials) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(credentials.email);
  await page.getByLabel("Contraseña").fill(credentials.password);
  await page
    .getByRole("main")
    .getByRole("button", { name: /iniciar sesión/i })
    .click();
  await page.waitForURL(/\/products/, { timeout: 10_000 });
}

function makeAuthFixture(user: keyof typeof E2E_USERS) {
  return async (
    { browser }: { browser: import("@playwright/test").Browser },
    use: (p: Page) => Promise<void>,
  ) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, E2E_USERS[user]);
    await use(page);
    await ctx.close();
  };
}

export const test = base.extend<{
  userPage: Page;
  adminPage: Page;
  authorPage: Page;
}>({
  userPage: makeAuthFixture("user"),
  adminPage: makeAuthFixture("admin"),
  authorPage: makeAuthFixture("author"),
});

export { expect };
