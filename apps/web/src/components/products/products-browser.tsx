"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PaginatedResponse, Product } from "@/lib/types";
import { useState } from "react";
import Link from "next/link";
import {
  Spinner,
  EmptyState,
  Button,
  Price,
  Input,
  Select,
  Badge,
} from "@/components/ui";

export interface ProductFilters {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  brand?: string;
  condition?: string;
  category?: string;
  page?: number;
  limit?: number;
}

interface ProductsBrowserProps {
  initialFilters?: ProductFilters;
  limit?: number;
  showFilters?: boolean;
  showPagination?: boolean;
}

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const CONDITIONS: Array<{ value: string; label: string }> = [
  { value: "New", label: "Nuevo" },
  { value: "Like New", label: "Como nuevo" },
  { value: "Good", label: "Buen estado" },
  { value: "Fair", label: "Aceptable" },
];

export function ProductsBrowser({
  initialFilters,
  limit = 12,
  showFilters = true,
  showPagination = true,
}: ProductsBrowserProps) {
  const [filters, setFilters] = useState<ProductFilters>({
    page: 1,
    limit,
    ...initialFilters,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["products", filters],
    queryFn: async () => {
      const cleaned: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== null && v !== "") {
          cleaned[k] = typeof v === "string" ? v : Number(v);
        }
      }
      const response = await api.get<PaginatedResponse<Product>>("/products", {
        params: cleaned,
      });
      return response.data;
    },
  });

  return (
    <div>
      {showFilters && (
        <form
          className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-border bg-surface-muted p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            setFilters((f) => ({
              ...f,
              search: String(formData.get("search") ?? "") || undefined,
              minPrice: formData.get("minPrice")
                ? Number(formData.get("minPrice"))
                : undefined,
              maxPrice: formData.get("maxPrice")
                ? Number(formData.get("maxPrice"))
                : undefined,
              size: String(formData.get("size") ?? "") || undefined,
              condition: String(formData.get("condition") ?? "") || undefined,
              page: 1,
            }));
          }}
        >
          <Input
            name="search"
            placeholder="Buscar prendas, marcas…"
            defaultValue={filters.search ?? ""}
            wrapperClassName="sm:col-span-2 lg:col-span-2"
            aria-label="Buscar productos"
          />
          <Input
            name="minPrice"
            type="number"
            min={0}
            step="1000"
            placeholder="Precio mín."
            defaultValue={filters.minPrice ?? ""}
            aria-label="Precio mínimo"
          />
          <Input
            name="maxPrice"
            type="number"
            min={0}
            step="1000"
            placeholder="Precio máx."
            defaultValue={filters.maxPrice ?? ""}
            aria-label="Precio máximo"
          />
          <Select
            name="size"
            defaultValue={filters.size ?? ""}
            aria-label="Filtrar por talla"
          >
            <option value="">Cualquier talla</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            name="condition"
            defaultValue={filters.condition ?? ""}
            aria-label="Filtrar por condición"
          >
            <option value="">Cualquier condición</option>
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2 lg:col-span-6 lg:flex lg:justify-end">
            <Button type="submit" className="w-full sm:w-auto">
              Aplicar filtros
            </Button>
          </div>
        </form>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando productos…
        </div>
      )}
      {isError && (
        <div className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          No pudimos cargar los productos. Intenta de nuevo.
        </div>
      )}

      {data && data.data.length === 0 && !isLoading && (
        <EmptyState
          title="No encontramos productos"
          description="Ajusta los filtros o explora todas las publicaciones."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFilters({ page: 1, limit })}
            >
              Limpiar filtros
            </Button>
          }
        />
      )}

      <div className="products-grid grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {data?.data.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {showPagination && data && data.meta.pages > 1 && (
        <nav
          className="mt-8 flex items-center justify-center gap-1"
          aria-label="Paginación"
        >
          <Button
            variant="secondary"
            onClick={() =>
              setFilters((f) => ({
                ...f,
                page: Math.max(1, (f.page ?? 1) - 1),
              }))
            }
            disabled={(filters.page ?? 1) <= 1}
            aria-label="Página anterior"
          >
            ‹
          </Button>
          {Array.from({ length: data.meta.pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setFilters((f) => ({ ...f, page: p }))}
              aria-current={p === data.meta.page ? "page" : undefined}
              aria-label={`Página ${p}`}
              className={`inline-flex h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary ${
                p === data.meta.page
                  ? "bg-secondary text-text-inverse"
                  : "border border-border bg-surface text-text-primary hover:bg-surface-muted"
              }`}
            >
              {p}
            </button>
          ))}
          <Button
            variant="secondary"
            onClick={() =>
              setFilters((f) => ({
                ...f,
                page: Math.min(data.meta.pages, (f.page ?? 1) + 1),
              }))
            }
            disabled={(filters.page ?? 1) >= data.meta.pages}
            aria-label="Página siguiente"
          >
            ›
          </Button>
        </nav>
      )}
    </div>
  );
}

const CONDITION_LABELS: Record<string, string> = {
  New: "Nuevo",
  "Like New": "Como nuevo",
  Good: "Buen estado",
  Fair: "Aceptable",
};

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="group block rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      <article className="flex h-full flex-col gap-3.5 transition-transform duration-300 group-hover:-translate-y-1">
        <div className="relative aspect-[3/4] overflow-hidden rounded-[14px] bg-paper-3">
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted">
              Sin imagen
            </div>
          )}
          {!product.isApproved && (
            <Badge
              variant="warning"
              className="absolute left-3 top-3 z-10 uppercase tracking-[0.1em]"
            >
              Pendiente
            </Badge>
          )}
          <button
            type="button"
            aria-label="Agregar a favoritos"
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-paper/95 transition-all hover:scale-110 hover:bg-paper"
            onClick={(e) => e.preventDefault()}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M19 14c1.5-1.4 3-3.3 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.2 1.5 4.1 3 5.5l7 7Z" />
            </svg>
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <h3 className="truncate font-sans text-sm font-medium leading-tight text-ink">
            {product.title}
          </h3>
          {product.brand && (
            <p className="truncate text-[11px] uppercase tracking-[0.08em] text-muted">
              {product.brand}
            </p>
          )}
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <Price
              value={product.price}
              className="font-display text-[16px] font-medium tabular-nums text-ink sm:text-[18px]"
            />
            <span className="text-[11px] text-muted">
              Talla {product.size} · {CONDITION_LABELS[product.condition] ?? product.condition}
            </span>
          </div>
          {product.seller && (
            <p className="mt-1 text-[11px] text-muted">
              Vendido por {product.seller.name}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}
