import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";
import crypto from "node:crypto";
import { API_URL } from "../utils/purchasable";

// ponytail: serial — backdate mutates shared e2e.db
test.describe.configure({ mode: "serial" });

function hdr(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}
function uniqueEmail() {
  return `acct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.test`;
}
function hashToken(t: string) {
  return crypto.createHash("sha256").update(t).digest("hex");
}
function prismaForE2e() {
  // ponytail: cron not exposed via HTTP — direct DB backdate is minimal e2e bridge
  const url = process.env.DATABASE_URL ?? `file:${path.join(__dirname, "../../apps/api/e2e.db")}`;
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

test.describe("Flujos de cuenta: verificación y recuperación", () => {
  test("happy verify: signup → verify → isVerified true → reuse 400", async ({ page }) => {
    const req = page.request;
    const email = uniqueEmail();
    const pwd = "segura12345";
    const signup = await req.post(`${API_URL}/auth/signup`, {
      data: { email, name: "Verify E2E", password: pwd, acceptedTerms: true },
    });
    expect(signup.status()).toBe(201);
    const body = await signup.json();
    const token = body.verificationToken as string;
    expect(token).toBeTruthy();
    const at = body.access_token as string;

    const me1 = await req.get(`${API_URL}/users/me`, { headers: hdr(at) });
    expect(me1.status()).toBe(200);
    expect((await me1.json()).isVerified).toBe(false);

    const vr = await req.post(`${API_URL}/auth/verify-email`, { data: { token } });
    expect(vr.status()).toBe(200);
    expect((await vr.json()).message).toMatch(/se verificó/i);

    const me2 = await req.get(`${API_URL}/users/me`, { headers: hdr(at) });
    expect((await me2.json()).isVerified).toBe(true);

    const reuse = await req.post(`${API_URL}/auth/verify-email`, { data: { token } });
    expect(reuse.status()).toBe(400);
    expect(await reuse.text()).toMatch(/no es válido o ya fue usado/i);
  });

  test("verify expirado: token con TTL vencido → 400", async ({ page }) => {
    const req = page.request;
    const email = uniqueEmail();
    const s = await req.post(`${API_URL}/auth/signup`, {
      data: { email, name: "Expire Verify", password: "segura12345", acceptedTerms: true },
    });
    expect(s.status()).toBe(201);
    const { verificationToken: tok } = (await s.json()) as { verificationToken: string };
    expect(tok).toBeTruthy();

    const prisma = prismaForE2e();
    try {
      await prisma.user.update({
        where: { email },
        data: { verificationTokenExpires: new Date(Date.now() - 60_000) },
      });
    } finally {
      await prisma.$disconnect();
    }

    const r = await req.post(`${API_URL}/auth/verify-email`, { data: { token: tok } });
    expect(r.status()).toBe(400);
    expect(await r.text()).toMatch(/no es válido o ya fue usado/i);
  });

  test("resend: reenvía, invalida anterior, bloquea verificado y sin auth 401", async ({ page }) => {
    const req = page.request;
    const email = uniqueEmail();
    const s = await req.post(`${API_URL}/auth/signup`, {
      data: { email, name: "Resend E2E", password: "segura12345", acceptedTerms: true },
    });
    expect(s.status()).toBe(201);
    const { verificationToken: oldTok, access_token: at } = (await s.json()) as {
      verificationToken: string;
      access_token: string;
    };

    const rs = await req.post(`${API_URL}/auth/resend-verification`, { headers: hdr(at), data: {} });
    expect(rs.status()).toBe(200);
    expect((await rs.json()).message).toMatch(/Te enviamos/i);

    // ponytail: resend no expone raw token — rotación probada vía invalidación del anterior
    const oldTry = await req.post(`${API_URL}/auth/verify-email`, { data: { token: oldTok } });
    expect(oldTry.status()).toBe(400);

    const known = crypto.randomBytes(32).toString("hex");
    const prisma = prismaForE2e();
    try {
      await prisma.user.update({
        where: { email },
        data: { verificationToken: hashToken(known), verificationTokenExpires: new Date(Date.now() + 60_000) },
      });
    } finally {
      await prisma.$disconnect();
    }
    const vr2 = await req.post(`${API_URL}/auth/verify-email`, { data: { token: known } });
    expect(vr2.status()).toBe(200);

    const rs2 = await req.post(`${API_URL}/auth/resend-verification`, { headers: hdr(at), data: {} });
    expect(rs2.status()).toBe(400);
    expect(await rs2.text()).toMatch(/ya está verificado/i);

    const noAuth = await req.post(`${API_URL}/auth/resend-verification`, { data: {} });
    expect(noAuth.status()).toBe(401);
  });

  test("forgot → reset happy: actualiza pwd, invalida antiguo y single-use", async ({ page }) => {
    const req = page.request;
    const email = uniqueEmail();
    const oldPwd = "segura12345";
    const newPwd = "nuevaSegura1!";
    await req.post(`${API_URL}/auth/signup`, {
      data: { email, name: "Reset E2E", password: oldPwd, acceptedTerms: true },
    });

    const fg = await req.post(`${API_URL}/auth/forgot-password`, { data: { email } });
    expect(fg.status()).toBe(200);
    const fgBody = await fg.json();
    expect(fgBody.message).toMatch(/Si el correo existe/i);
    const resetToken = fgBody.resetToken as string;
    expect(resetToken).toBeTruthy();

    const rs = await req.post(`${API_URL}/auth/reset-password`, { data: { token: resetToken, password: newPwd } });
    expect(rs.status()).toBe(200);
    expect((await rs.json()).message).toMatch(/se actualizó/i);

    const oldLogin = await req.post(`${API_URL}/auth/login`, { data: { email, password: oldPwd } });
    expect(oldLogin.status()).toBe(401);
    const newLogin = await req.post(`${API_URL}/auth/login`, { data: { email, password: newPwd } });
    expect(newLogin.status()).toBe(200);

    const reuse = await req.post(`${API_URL}/auth/reset-password`, { data: { token: resetToken, password: "otra12345!" } });
    expect(reuse.status()).toBe(400);
    expect(await reuse.text()).toMatch(/no es válido o expiró/i);
  });

  test("reset expirado y token inválido → 400", async ({ page }) => {
    const req = page.request;
    const email = uniqueEmail();
    await req.post(`${API_URL}/auth/signup`, {
      data: { email, name: "Reset Exp", password: "segura12345", acceptedTerms: true },
    });
    const fg = await req.post(`${API_URL}/auth/forgot-password`, { data: { email } });
    const { resetToken } = (await fg.json()) as { resetToken: string };
    expect(resetToken).toBeTruthy();

    const prisma = prismaForE2e();
    try {
      await prisma.user.update({ where: { email }, data: { resetTokenExpires: new Date(Date.now() - 60_000) } });
    } finally {
      await prisma.$disconnect();
    }

    const r1 = await req.post(`${API_URL}/auth/reset-password`, { data: { token: resetToken, password: "nuevaSegura1!" } });
    expect(r1.status()).toBe(400);
    expect(await r1.text()).toMatch(/no es válido o expiró/i);

    const r2 = await req.post(`${API_URL}/auth/reset-password`, {
      data: { token: "garbage-not-a-token-" + Date.now(), password: "nuevaSegura1!" },
    });
    expect(r2.status()).toBe(400);
  });

  test("forgot enumeration guard: correo inexistente no fuga token", async ({ page }) => {
    const req = page.request;
    const ghost = `ghost-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@e2e.test`;
    const r = await req.post(`${API_URL}/auth/forgot-password`, { data: { email: ghost } });
    expect(r.status()).toBe(200);
    const b = await r.json();
    expect(b.message).toMatch(/Si el correo existe/i);
    expect(b.resetToken).toBeUndefined();
  });

  test("UI: verify-email", async ({ page }) => {
    const req = page.request;
    const email = uniqueEmail();
    const s = await req.post(`${API_URL}/auth/signup`, {
      data: { email, name: "UI Verify", password: "segura12345", acceptedTerms: true },
    });
    const { verificationToken } = (await s.json()) as { verificationToken: string };
    await page.goto(`/verify-email?token=${encodeURIComponent(verificationToken)}`);
    await page.getByRole("button", { name: /Verificar mi correo/i }).click();
    await expect(page.getByText(/¡Correo verificado!/i)).toBeVisible({ timeout: 10_000 });
  });

  test("UI: forgot-password", async ({ page }) => {
    const req = page.request;
    const email = uniqueEmail();
    await req.post(`${API_URL}/auth/signup`, {
      data: { email, name: "UI Forgot", password: "segura12345", acceptedTerms: true },
    });
    await page.goto("/forgot-password");
    await page.getByLabel(/Correo electrónico/i).fill(email);
    await page.getByRole("button", { name: /Enviar instrucciones/i }).click();
    await expect(page.getByText(/Si el correo existe/i)).toBeVisible({ timeout: 10_000 });
  });

  test("UI: reset-password", async ({ page }) => {
    const req = page.request;
    const email = uniqueEmail();
    await req.post(`${API_URL}/auth/signup`, {
      data: { email, name: "UI Reset", password: "segura12345", acceptedTerms: true },
    });
    const fg = await req.post(`${API_URL}/auth/forgot-password`, { data: { email } });
    const { resetToken } = (await fg.json()) as { resetToken: string };
    await page.goto(`/reset-password?token=${encodeURIComponent(resetToken)}`);
    await page.getByLabel("Nueva contraseña", { exact: true }).fill("uiNueva123!");
    await page.getByLabel("Confirmar contraseña", { exact: true }).fill("uiNueva123!");
    await page.getByRole("button", { name: /Actualizar contraseña/i }).click();
    await expect(page.getByText(/se actualiz/i)).toBeVisible({ timeout: 10_000 });
    const l = await req.post(`${API_URL}/auth/login`, { data: { email, password: "uiNueva123!" } });
    expect(l.status()).toBe(200);
  });
});
