import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductGallery } from "../product-gallery";

const img = (n: number) => ({
  url: `https://example.com/jacket-${n}.jpg`,
  alt: `Vista ${n} de la chaqueta`,
});

// next/image rewrites `src` through its optimizer (`/_next/image?url=...`)
// rather than passing the original URL through verbatim.
const expectImageSrc = (element: HTMLElement, url: string) =>
  expect(element.getAttribute("src")).toContain(encodeURIComponent(url));

describe("ProductGallery", () => {
  afterEach(cleanup);

  it("muestra la primera foto en el visor principal y una miniatura por cada foto", () => {
    render(
      <ProductGallery
        images={[img(1), img(2), img(3)]}
        title="Vintage denim jacket"
      />,
    );

    const mainImage = screen.getByRole("img", { name: "Vista 1 de la chaqueta" });
    expectImageSrc(mainImage, "https://example.com/jacket-1.jpg");
    expect(
      screen.getByRole("button", { name: /ver foto 1 de/i }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("button", { name: /ver foto 2 de/i }),
    ).toHaveAttribute("aria-current", "false");
  });

  it("cambia la foto principal al hacer click en una miniatura", async () => {
    const user = userEvent.setup();
    render(
      <ProductGallery images={[img(1), img(2)]} title="Vintage denim jacket" />,
    );

    await user.click(screen.getByRole("button", { name: /ver foto 2 de/i }));

    expectImageSrc(
      screen.getByRole("img", { name: "Vista 2 de la chaqueta" }),
      "https://example.com/jacket-2.jpg",
    );
    expect(
      screen.getByRole("button", { name: /ver foto 2 de/i }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("button", { name: /ver foto 1 de/i }),
    ).toHaveAttribute("aria-current", "false");
  });

  // Regression: a screen-reader user has no visual cue that the main image
  // swapped, since aria-current changes on the thumbnails aren't announced by
  // themselves — the live region is what actually confirms the change.
  it("anuncia la foto activa en una región en vivo para lectores de pantalla", async () => {
    const user = userEvent.setup();
    render(
      <ProductGallery images={[img(1), img(2)]} title="Vintage denim jacket" />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Foto 1 de 2");

    await user.click(screen.getByRole("button", { name: /ver foto 2 de/i }));

    expect(screen.getByRole("status")).toHaveTextContent("Foto 2 de 2");
  });

  // Item 4: zoom is a real control — an accessible button opening a dialog
  // with role="dialog" + aria-modal and focus trapped inside — not hover CSS
  // a keyboard or screen-reader user can't reach.
  it("abre el zoom como diálogo accesible y lo cierra con Escape devolviendo el foco", async () => {
    const user = userEvent.setup();
    render(
      <ProductGallery images={[img(1), img(2)]} title="Vintage denim jacket" />,
    );

    const trigger = screen.getByRole("button", { name: /ampliar imagen/i });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // The dialog's accessible name is the photo's alt text (aria-labelledby).
    expect(dialog).toHaveTextContent("Vista 1 de la chaqueta");
    const zoomedImage = dialog.querySelector("img");
    expect(zoomedImage).toHaveAttribute("src", "https://example.com/jacket-1.jpg");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  // The zoom dialog shows only a photo — no "Cancelar" button of its own —
  // so Escape and the backdrop are not enough: it needs a close control a
  // sighted user can actually find.
  it("el zoom tiene un botón de cerrar visible que devuelve el foco al abrirlo", async () => {
    const user = userEvent.setup();
    render(
      <ProductGallery images={[img(1), img(2)]} title="Vintage denim jacket" />,
    );

    const trigger = screen.getByRole("button", { name: /ampliar imagen/i });
    await user.click(trigger);

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("no muestra miniaturas cuando el producto tiene una sola foto", () => {
    render(<ProductGallery images={[img(1)]} title="Vintage denim jacket" />);

    expect(
      screen.queryByRole("button", { name: /ver foto/i }),
    ).not.toBeInTheDocument();
  });

  it("muestra un marcador cuando el producto no tiene fotos", () => {
    render(<ProductGallery images={[]} title="Vintage denim jacket" />);

    expect(screen.getByText("Sin imagen")).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: "Vintage denim jacket" }),
    ).not.toBeInTheDocument();
  });

  // The caller (ProductDetail) resets the gallery by remounting it with a
  // new `key` (covering the product id and the images themselves) rather
  // than by reconciling a stale index against a changed picture set — this
  // confirms that's actually a full reset, not a partial one.
  it("vuelve a la primera foto cuando el componente se vuelve a montar con otras imágenes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ProductGallery
        key="product-a"
        images={[
          { url: "https://example.com/a1.jpg", alt: "A1" },
          { url: "https://example.com/a2.jpg", alt: "A2" },
        ]}
        title="Product A"
      />,
    );

    await user.click(screen.getByRole("button", { name: /ver foto 2 de/i }));
    expectImageSrc(
      screen.getByRole("img", { name: "A2" }),
      "https://example.com/a2.jpg",
    );

    rerender(
      <ProductGallery
        key="product-b"
        images={[
          { url: "https://example.com/b1.jpg", alt: "B1" },
          { url: "https://example.com/b2.jpg", alt: "B2" },
        ]}
        title="Product B"
      />,
    );

    expectImageSrc(
      screen.getByRole("img", { name: "B1" }),
      "https://example.com/b1.jpg",
    );
    expect(
      screen.getByRole("button", { name: /ver foto 1 de/i }),
    ).toHaveAttribute("aria-current", "true");
  });
});
