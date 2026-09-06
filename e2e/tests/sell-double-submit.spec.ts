import { test, expect } from "@playwright/test";
import { API_URL, createBuyer } from "../utils/purchasable";

// QA-1: `handleSubmit` en /sell no descarta un segundo envío del mismo
// formulario. Su única protección es `disabled={isSubmitting}`, y el `finally`
// devuelve `isSubmitting` a false también en la ruta de éxito — es decir, en
// cuanto la respuesta vuelve, mientras `router.push` todavía no ha desmontado
// la página y el formulario conserva sus valores. Un clic que caiga en esa
// ventana vuelve a enviar la misma prenda.
//
// La ventana es [respuesta recibida, navegación completada], NO
// [clic, siguiente render]. Esto importa para el test: un `dblclick()` (dos
// clics a ~0 ms) NO reproduce el fallo, porque el segundo llega mientras el
// botón sigue legítimamente deshabilitado. Hay que separarlos lo justo para
// caer después de la respuesta. De ahí el ratón de bajo nivel con una pausa
// deliberada: `page.mouse` no espera a que el botón se rehabilite, que es
// exactamente lo que hace un usuario que pulsa dos veces por impaciencia.
//
// El carrito ya resuelve esto bien: `handleCheckout` abre con
// `if (checkout.isPending) return`, una guarda síncrona que no depende del
// ciclo de render. Este test fija la misma expectativa para la venta.

const hdr = (token: string) => ({ Authorization: `Bearer ${token}` });

test("un doble clic en «Publicar producto» crea una sola publicación", async ({
  page,
  request,
}) => {
  const seller = await createBuyer(request);

  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(seller.email);
  await page.getByLabel("Contraseña").fill(seller.password);
  await page
    .getByRole("main")
    .getByRole("button", { name: /iniciar sesión/i })
    .click();
  await page.waitForURL(/\/products/, { timeout: 10_000 });

  const submissions: number[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url() === `${API_URL}/products`) {
      submissions.push(Date.now());
    }
  });

  const title = `DobleClic ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await page.goto("/sell");
  await page.getByLabel("Título").fill(title);
  await page
    .getByLabel("Descripción")
    .fill("Regresión QA-1: doble clic en el botón de publicar.");
  await page.getByLabel("Categoría").selectOption("Chaquetas");
  await page.getByLabel("Talla").selectOption("M");
  await page.getByLabel(/precio/i).fill("120000");

  const submit = page.getByRole("button", { name: /publicar producto/i });
  await expect(submit).toBeEnabled();
  // `page.mouse` clica en coordenadas del viewport y no desplaza la página,
  // así que hay que traer el botón a la vista antes de medirlo.
  await submit.scrollIntoViewIfNeeded();
  const box = await submit.boundingBox();
  if (!box) throw new Error("El botón de publicar no es visible");
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];

  // Dos clics reales sobre el mismo punto. El segundo se ancla a la llegada de
  // la respuesta del primero en vez de a una pausa fija: una pausa fija no
  // controla la ventana, la adivina, y el test resulta intermitente porque el
  // tiempo de respuesta varía entre máquinas y entre `next dev` y producción.
  // `page.mouse` no hace comprobaciones de accionabilidad, así que no espera a
  // que el botón se rehabilite ni serializa los eventos: los envía tal cual,
  // como un ratón físico.
  const firstSubmit = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url() === `${API_URL}/products`,
  );
  await page.mouse.click(cx, cy);
  await firstSubmit;
  await page.mouse.click(cx, cy);

  await page.waitForURL(/\/products\?published=1/, { timeout: 10_000 });
  // Sin esto, un segundo POST todavía en vuelo no habría llegado a la base de
  // datos cuando se consulta /products/mine, y el test pasaría en falso.
  await page.waitForLoadState("networkidle");

  const mine = await request.get(`${API_URL}/products/mine`, {
    headers: hdr(seller.token),
  });
  expect(mine.status()).toBe(200);
  const listings = ((await mine.json()).data as Array<{ title: string }>).filter(
    (p) => p.title === title,
  );

  expect(
    listings,
    `POST /products enviados: ${submissions.length}`,
  ).toHaveLength(1);
});
