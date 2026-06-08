"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PaginatedResponse, Product } from "@/lib/types";
import { useState } from "react";
import Link from "next/link";
import {
  Spinner,
  EmptyState,
  Card,
  Badge,
  Button,
  Price,
  Input,
  Select,
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
const CONDITIONS = ["New", "Like New", "Good", "Fair"];

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
          className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-6"
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
            placeholder="Search items, brands…"
            defaultValue={filters.search ?? ""}
            className="sm:col-span-2 lg:col-span-2"
            aria-label="Search products"
          />
          <Input
            name="minPrice"
            type="number"
            min={0}
            step="0.01"
            placeholder="Min price"
            defaultValue={filters.minPrice ?? ""}
            aria-label="Minimum price"
          />
          <Input
            name="maxPrice"
            type="number"
            min={0}
            step="0.01"
            placeholder="Max price"
            defaultValue={filters.maxPrice ?? ""}
            aria-label="Maximum price"
          />
          <Select
            name="size"
            defaultValue={filters.size ?? ""}
            aria-label="Filter by size"
          >
            <option value="">Any size</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            name="condition"
            defaultValue={filters.condition ?? ""}
            aria-label="Filter by condition"
          >
            <option value="">Any condition</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2 lg:col-span-6 lg:flex lg:justify-end">
            <Button type="submit" className="w-full sm:w-auto">
              Apply filters
            </Button>
          </div>
        </form>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Loading items…
        </div>
      )}
      {isError && (
        <div className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          Failed to load products. Please try again.
        </div>
      )}

      {data && data.data.length === 0 && !isLoading && (
        <EmptyState
          title="No products found"
          description="Try adjusting your filters or browse all listings."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFilters({ page: 1, limit })}
            >
              Clear filters
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {data?.data.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {showPagination && data && data.meta.pages > 1 && (
        <nav
          className="mt-8 flex items-center justify-center gap-1"
          aria-label="Pagination"
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setFilters((f) => ({
                ...f,
                page: Math.max(1, (f.page ?? 1) - 1),
              }))
            }
            disabled={(filters.page ?? 1) <= 1}
            aria-label="Previous page"
          >
            ‹
          </Button>
          {Array.from({ length: data.meta.pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setFilters((f) => ({ ...f, page: p }))}
              aria-current={p === data.meta.page ? "page" : undefined}
              className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary ${
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
            size="sm"
            onClick={() =>
              setFilters((f) => ({
                ...f,
                page: Math.min(data.meta.pages, (f.page ?? 1) + 1),
              }))
            }
            disabled={(filters.page ?? 1) >= data.meta.pages}
            aria-label="Next page"
          >
            ›
          </Button>
        </nav>
      )}
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-lg"
    >
      <Card
        as="article"
        className="flex h-full flex-col gap-3 overflow-hidden p-0 transition-shadow group-hover:shadow-md"
      >
        <div className="relative aspect-square bg-surface-muted">
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">
              No image
            </div>
          )}
          {product._count?.reviews ? (
            <span className="absolute right-2 top-2">
              <Badge variant="default">
                {product._count.reviews} review
                {product._count.reviews === 1 ? "" : "s"}
              </Badge>
            </span>
          ) : null}
          {!product.isApproved && (
            <span className="absolute left-2 top-2">
              <Badge variant="warning">Pending</Badge>
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 px-3 pb-3">
          <h3 className="truncate text-sm font-semibold text-text-primary">
            {product.title}
          </h3>
          {product.brand && (
            <p className="truncate text-xs text-text-muted">{product.brand}</p>
          )}
          <p className="line-clamp-2 text-xs text-text-muted">
            {product.description}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <Price value={product.price} className="text-base font-semibold" />
            <span className="text-xs text-text-muted">
              {product.condition} · {product.size}
            </span>
          </div>
          {product.seller && (
            <p className="text-xs text-text-muted">
              Sold by {product.seller.name}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}
