import { test as base, expect, type Page } from "@playwright/test";
import { E2E_USERS } from "../utils/seed";

type C = (typeof E2E_USERS)[keyof typeof E2E_USERS];

async function loginAs(p: Page, c: C) {
  await p.context().clearCookies();
  await p.goto("/login");
  await p.getByLabel("Correo electrónico").fill(c.email);
  await p.getByLabel("Contraseña").fill(c.password);
  await p.getByRole("main").getByRole("button", { name: /iniciar sesión/i }).click();
  await p.waitForURL(/\/products/, { timeout: 10_000 });
}

const make = (k: keyof typeof E2E_USERS) => async ({ browser }: { browser: import("@playwright/test").Browser }, use: (p: Page) => Promise<void>) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAs(page, E2E_USERS[k]);
  await use(page);
  await ctx.close();
};

export const test = base.extend<{ userPage: Page; adminPage: Page; authorPage: Page }>({
  userPage: make("user"),
  adminPage: make("admin"),
  authorPage: make("author"),
});

export { expect };
