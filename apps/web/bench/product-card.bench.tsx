import { bench, describe, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { makeProducts } from "./fixtures";
import { TestProviders } from "@/test-utils/TestProviders";

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

// ProductCard renders a FavoriteButton, which reads auth state and queries
// favorites via react-query — both need their provider in the tree or the
// render throws ("useAuth must be used within an AuthProvider").
describe("ProductCard", () => {
  bench("render a single card", () => {
    renderToStaticMarkup(
      <TestProviders>
        <ProductCard product={single} />
      </TestProviders>,
    );
  });

  bench("render a 24-card grid", () => {
    renderToStaticMarkup(
      <TestProviders>
        <div className="products-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </TestProviders>,
    );
  });
});
