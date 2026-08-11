import { bench, describe, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { makeProducts } from "./fixtures";

// next/link needs the app-router runtime, which doesn't exist outside Next.
// The unit tests stub it the same way.
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { ProductCard } = await import("@/components/products/products-browser");

const products = makeProducts(24);
const single = products[0];

describe("ProductCard", () => {
  bench("render a single card", () => {
    renderToStaticMarkup(<ProductCard product={single} />);
  });

  bench("render a 24-card grid", () => {
    renderToStaticMarkup(
      <div className="products-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>,
    );
  });
});
