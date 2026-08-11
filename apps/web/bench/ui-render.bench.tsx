import { bench, describe } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Price,
  Select,
  StarRating,
} from "@/components/ui";
import { makeProducts } from "./fixtures";

const products = makeProducts(48);

describe("ui primitives", () => {
  bench("render 200 buttons", () => {
    renderToStaticMarkup(
      <>
        {Array.from({ length: 200 }, (_, i) => (
          <Button
            key={i}
            variant={i % 2 ? "primary" : "secondary"}
            size={i % 3 === 0 ? "lg" : "md"}
            fullWidth={i % 5 === 0}
          >
            Comprar {i}
          </Button>
        ))}
      </>,
    );
  });

  bench("render 200 price + badge pairs", () => {
    renderToStaticMarkup(
      <>
        {products.map((product) => (
          <span key={product.id}>
            <Price value={product.price} />
            <Badge variant={product.isApproved ? "success" : "warning"}>
              {product.condition}
            </Badge>
            <StarRating value={(product._count?.reviews ?? 0) % 6} />
          </span>
        ))}
      </>,
    );
  });

  bench("render filter form", () => {
    renderToStaticMarkup(
      <Card as="section">
        <Input name="search" label="Buscar" placeholder="Buscar prendas…" />
        <Input name="minPrice" type="number" label="Precio mínimo" />
        <Input name="maxPrice" type="number" label="Precio máximo" />
        <Select name="size" label="Talla">
          {["XS", "S", "M", "L", "XL", "XXL"].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
        <Button type="submit">Aplicar filtros</Button>
      </Card>,
    );
  });

  bench("render empty state", () => {
    renderToStaticMarkup(
      <EmptyState
        title="No encontramos productos"
        description="Ajusta los filtros o explora todas las publicaciones."
        action={<Button variant="secondary">Limpiar filtros</Button>}
      />,
    );
  });
});

describe("product grid", () => {
  bench("render 48 product cards (static markup)", () => {
    renderToStaticMarkup(
      <div className="products-grid">
        {products.map((product) => (
          <Card key={product.id} as="article">
            {product.images?.[0] && (
              <img src={product.images[0]} alt={product.title} />
            )}
            <h3>{product.title}</h3>
            {product.brand && <p>{product.brand}</p>}
            <Price value={product.price} />
            <Badge variant={product.isApproved ? "info" : "warning"}>
              {product.condition}
            </Badge>
          </Card>
        ))}
      </div>,
    );
  });
});
