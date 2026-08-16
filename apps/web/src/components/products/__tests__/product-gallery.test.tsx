import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductGallery } from "../product-gallery";

describe("ProductGallery", () => {
  it("muestra la primera foto en el visor principal y una miniatura por cada foto", () => {
    render(
      <ProductGallery
        images={[
          "https://example.com/jacket-1.jpg",
          "https://example.com/jacket-2.jpg",
          "https://example.com/jacket-3.jpg",
        ]}
        title="Vintage denim jacket"
      />,
    );

    const mainImage = screen.getByRole("img", { name: "Vintage denim jacket" });
    expect(mainImage).toHaveAttribute("src", "https://example.com/jacket-1.jpg");
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
      <ProductGallery
        images={[
          "https://example.com/jacket-1.jpg",
          "https://example.com/jacket-2.jpg",
        ]}
        title="Vintage denim jacket"
      />,
    );

    await user.click(screen.getByRole("button", { name: /ver foto 2 de/i }));

    expect(
      screen.getByRole("img", { name: "Vintage denim jacket" }),
    ).toHaveAttribute("src", "https://example.com/jacket-2.jpg");
    expect(
      screen.getByRole("button", { name: /ver foto 2 de/i }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("button", { name: /ver foto 1 de/i }),
    ).toHaveAttribute("aria-current", "false");
  });

  // Regression: a screen-reader user has no visual cue that the main image
  // swapped, since aria-current changes on the thumbnail aren't announced by
  // themselves — the live region is what actually confirms the change.
  it("anuncia la foto activa en una región en vivo para lectores de pantalla", async () => {
    const user = userEvent.setup();
    render(
      <ProductGallery
        images={["https://example.com/jacket-1.jpg", "https://example.com/jacket-2.jpg"]}
        title="Vintage denim jacket"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Foto 1 de 2");

    await user.click(screen.getByRole("button", { name: /ver foto 2 de/i }));

    expect(screen.getByRole("status")).toHaveTextContent("Foto 2 de 2");
  });

  it("no muestra miniaturas cuando el producto tiene una sola foto", () => {
    render(
      <ProductGallery
        images={["https://example.com/jacket-1.jpg"]}
        title="Vintage denim jacket"
      />,
    );

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
        images={["https://example.com/a1.jpg", "https://example.com/a2.jpg"]}
        title="Product A"
      />,
    );

    await user.click(screen.getByRole("button", { name: /ver foto 2 de/i }));
    expect(
      screen.getByRole("img", { name: "Product A" }),
    ).toHaveAttribute("src", "https://example.com/a2.jpg");

    rerender(
      <ProductGallery
        key="product-b"
        images={["https://example.com/b1.jpg", "https://example.com/b2.jpg"]}
        title="Product B"
      />,
    );

    expect(
      screen.getByRole("img", { name: "Product B" }),
    ).toHaveAttribute("src", "https://example.com/b1.jpg");
    expect(
      screen.getByRole("button", { name: /ver foto 1 de/i }),
    ).toHaveAttribute("aria-current", "true");
  });
});
