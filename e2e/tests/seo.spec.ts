import { test, expect } from "@playwright/test";
import { API_URL } from "../utils/purchasable";

// Item 11: SEO técnico — tags dinámicos en el detalle de producto, sitemap
// con los aprobados y robots.txt apuntando al sitemap.

test.describe("SEO técnico", () => {
  test("el detalle de producto expone title y description del listing", async ({
    page,
    request,
  }) => {
    const res = await request.get(`${API_URL}/products?limit=1`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const product = body.data?.[0];
    expect(product).toBeTruthy();

    await page.goto(`/products/${product.id}`);

    // generateMetadata dinámico: el <title> lleva el título real del listing.
    await expect(page).toHaveTitle(new RegExp(product.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveCount(1);
    expect(await description.getAttribute("content")).toBeTruthy();
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute("content", product.title);
  });

  test("el sitemap incluye URLs de productos aprobados", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("<urlset");
    // Un <loc> por listing aprobado — el seed trae 2 aprobados.
    const locs = body.match(/<loc>/g)?.length ?? 0;
    expect(locs).toBeGreaterThanOrEqual(3);
    expect(body).toMatch(/<loc>[^<]*\/products\/[^<]+<\/loc>/);
  });

  test("robots.txt declara el sitemap y bloquea superficies privadas", async ({
    request,
  }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/Sitemap: .+\/sitemap\.xml/);
    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Disallow: /cart");
  });
});
