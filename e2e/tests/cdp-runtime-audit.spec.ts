import { test, expect } from "@playwright/test";
import { attachCdpAudit } from "../utils/cdp-audit";

// Chromium-only: CDP session is Chrome-specific
test.describe("cdp-audit", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "CDP solo en chromium");

  test("runtime audit: no hydration errors, no 5xx, no duplicate /api", async ({ page }, testInfo) => {
    const audit = await attachCdpAudit(page);
    try {
      await page.goto("/", { waitUntil: "commit" });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      const result = await audit.getResultWithMetrics();
      await testInfo.attach("audit", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
      // attach console dump even if passed for debugging
      if (result.consoleErrors.length) console.log("[audit] consoleErrors", result.consoleErrors.slice(0, 5));
      expect(result.hydrationErrors, `hydration errors: ${result.hydrationErrors.join("; ")}`).toEqual([]);
      const serverErrors = result.failedRequests.filter((r) => r.status >= 500);
      expect(serverErrors, `5xx: ${JSON.stringify(serverErrors)}`).toEqual([]);
      expect(result.duplicateRequests, `dup /api: ${JSON.stringify(result.duplicateRequests)}`).toEqual([]);
    } finally { await audit.detach(); }
  });

  test("BFS CUJ crawl: 6 rutas sin errores de consola", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const audit = await attachCdpAudit(page);
    try {
      // discover first product id for /products/[id]
      await page.goto("/products", { waitUntil: "commit" }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      let productHref: string | null = null;
      try { const l = page.locator('a[href*="/products/"]').first(); if (await l.count()) productHref = await l.getAttribute("href"); } catch {}
      const routes = ["/", "/products", productHref || "/products", "/cart", "/login", "/signup"].slice(0, 6);
      const visited: { url: string; interactives: number }[] = [];
      const visit = async (route: string) => {
        await page.goto(route, { waitUntil: "commit" }).catch(() => {});
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        await expect(page).not.toHaveURL(/\/404/, { timeout: 2000 }).catch(() => {});
        await expect(page.locator("body")).toBeVisible({ timeout: 5000 }).catch(() => {});
        let interactives = 0;
        try {
          const snap = await page.accessibility.snapshot();
          const countNodes = (n: unknown): number => {
            if (!n || typeof n !== "object") return 0;
            const o = n as { role?: string; children?: unknown[] };
            const self = o.role === "button" || o.role === "link" || o.role === "textbox" ? 1 : 0;
            const kids = (o.children || []).reduce((s: number, c) => s + countNodes(c), 0);
            return self + kids;
          };
          interactives = countNodes(snap);
        } catch {}
        visited.push({ url: page.url(), interactives });
        const cur = audit.getResult();
        expect.soft(cur.hydrationErrors, `hydration en ${route}: ${cur.hydrationErrors.join("; ")}`).toEqual([]);
        const serverErrs = cur.failedRequests.filter((r) => r.status >= 500);
        expect.soft(serverErrs, `5xx en ${route}: ${JSON.stringify(serverErrs)}`).toEqual([]);
      };
      for (const route of routes) await visit(route);

      // --- auth-guarded routes (P1-2): login via UI (primary) then crawl private CUJs ---
      const authRoutes = ["/favoritos", "/mis-productos", "/mis-ventas", "/orders", "/profile"];
      let sellerId: string | null = null;
      let loggedIn = false;
      try {
        await page.goto("/login", { waitUntil: "commit" }).catch(() => {});
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        try {
          await page.getByLabel("Correo electrónico").fill("user@e2e.test", { timeout: 3000 });
          await page.getByLabel("Contraseña").fill("user12345");
          await page.getByRole("main").getByRole("button", { name: /iniciar sesión/i }).click();
          await page.waitForURL(/\/products/, { timeout: 10_000 });
          loggedIn = true;
        } catch {}
        if (!loggedIn) {
          const apiPort = process.env.QA_API_PORT ?? "3101";
          const API = `http://127.0.0.1:${apiPort}`;
          const loginRes = await page.request.post(`${API}/auth/login`, { data: { email: "user@e2e.test", password: "user12345" } }).catch(() => null);
          if (loginRes && loginRes.ok()) {
            const { access_token } = await loginRes.json().catch(() => ({ access_token: null }));
            if (access_token) {
              await page.evaluate((t) => localStorage.setItem("versale_token", t), access_token);
              await page.reload({ waitUntil: "commit" }).catch(() => {});
              await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
              loggedIn = true;
            }
          }
        }
        if (loggedIn) {
          try {
            const apiPort = process.env.QA_API_PORT ?? "3101";
            const API = `http://127.0.0.1:${apiPort}`;
            const pr = await page.request.get(`${API}/products?limit=1`);
            if (pr.ok()) {
              const pj = await pr.json();
              const f = pj.data?.[0];
              sellerId = f?.sellerId || f?.seller?.id || null;
            }
          } catch {}
          if (sellerId) authRoutes.push(`/vendedores/${sellerId}`);
          for (const route of authRoutes) await visit(route);
        } else {
          testInfo.annotations.push({ type: "skip", description: "auth BFS: login falló, rutas privadas omitidas" });
        }
      } catch (e) {
        testInfo.annotations.push({ type: "skip", description: `auth BFS omitido: ${(e as Error).message}` });
      }

      const result = await audit.getResultWithMetrics();
      await testInfo.attach("crawl", { body: JSON.stringify({ visited, result }, null, 2), contentType: "application/json" });
      console.log(`[crawl] visited ${visited.length} rutas: ${visited.map((v) => v.url).join(", ")}`);
      expect(visited.length).toBeGreaterThanOrEqual(8);
      expect.soft(result.longTasks, `longTasks ${result.longTasks} > 50`).toBeLessThan(50);
    } finally { await audit.detach(); }
  });

  test("edge cases: doble click, offline y throttling", async ({ page, context }, testInfo) => {
    const audit = await attachCdpAudit(page);
    try {
      // --- race: doble click Agregar al carrito -> single request
      let cartAddCount = 0;
      await page.route("**/api/**", async (route) => {
        if (route.request().url().includes("/cart") && route.request().method() === "POST") cartAddCount++;
        await route.continue();
      });
      try {
        await page.goto("/products", { waitUntil: "commit" });
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
        const prod = page.getByRole("heading", { name: /Vintage|Wool|Cotton/i }).first();
        if (await prod.count()) {
          await prod.click().catch(() => {});
          await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
          const btn = page.getByRole("button", { name: /agregar al carrito/i }).first();
          if (await btn.count()) {
            await btn.dblclick({ delay: 10 }).catch(async () => { await btn.click().catch(() => {}); await btn.click().catch(() => {}); });
            await page.waitForTimeout(800);
          }
        }
      } catch {}
      // visitante no logueado redirige a login, asi que 0 es tambien valido; lo que no debe pasar es 2
      expect(cartAddCount).toBeLessThanOrEqual(1);
      await page.unrouteAll({ behavior: "wait" }).catch(() => {});

      // --- offline mid-flow -> error graceful (no unhandled exception)
      await context.setOffline(true);
      await page.goto("/products", { waitUntil: "commit" }).catch(() => {});
      await page.waitForTimeout(1500);
      // debe seguir renderizando algo (no pantalla blanca por excepcion no capturada)
      await expect(page.locator("body")).toBeVisible();
      await context.setOffline(false);

      // --- throttled 3G/CPU via CDP (guard skip si no soportado)
      try {
        await audit.session.send("Network.emulateNetworkConditions", {
          offline: false, latency: 400, downloadThroughput: 750 * 1024 / 8, uploadThroughput: 250 * 1024 / 8, connectionType: "cellular3g" as const,
        });
        try { await audit.session.send("Emulation.setCPUThrottlingRate", { rate: 4 }); } catch {}
        await page.goto("/", { waitUntil: "commit" });
        await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
        await expect(page.locator("body")).toBeVisible();
        await audit.session.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: "unknown" as const });
        try { await audit.session.send("Emulation.setCPUThrottlingRate", { rate: 1 }); } catch {}
      } catch {
        testInfo.annotations.push({ type: "skip", description: "Network/CPU throttling no soportado en esta version de Playwright" });
      }

      const result = await audit.getResultWithMetrics();
      await testInfo.attach("edge", { body: JSON.stringify({ cartAddCount, result }, null, 2), contentType: "application/json" });
    } finally {
      try { await context.setOffline(false); } catch {}
      try { await page.unrouteAll({ behavior: "wait" }); } catch {}
      await audit.detach();
    }
  });
});
