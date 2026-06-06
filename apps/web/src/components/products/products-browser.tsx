"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PaginatedResponse, Product } from "@/lib/types";
import { useState } from "react";
import Link from "next/link";
import { Spinner, EmptyState, Card, Badge } from "@/components/ui";

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
          className="grid grid-cols-1 sm:grid-cols-6 gap-3 mb-6"
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
          <input
            name="search"
            placeholder="Search..."
            defaultValue={filters.search ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 sm:col-span-2"
          />
          <input
            name="minPrice"
            type="number"
            min={0}
            step="0.01"
            placeholder="Min price"
            defaultValue={filters.minPrice ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
          />
          <input
            name="maxPrice"
            type="number"
            min={0}
            step="0.01"
            placeholder="Max price"
            defaultValue={filters.maxPrice ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
          />
          <select
            name="size"
            defaultValue={filters.size ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
          >
            <option value="">Any size</option>
            {["XS", "S", "M", "L", "XL", "XXL"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            name="condition"
            defaultValue={filters.condition ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
          >
            <option value="">Any condition</option>
            {["New", "Like New", "Good", "Fair"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 px-3 py-2 hover:opacity-90"
          >
            Apply
          </button>
        </form>
      )}

      {isLoading && (
        <div className="py-8 flex items-center justify-center gap-2 text-zinc-500">
          <Spinner className="h-5 w-5" /> Loading…
        </div>
      )}
      {isError && (
        <p className="text-red-500 py-4">Failed to load products.</p>
      )}

      {data && data.data.length === 0 && !isLoading && (
        <EmptyState
          title="No products found"
          description="Try adjusting your filters or browse all listings."
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {data?.data.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {showPagination && data && data.meta.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() =>
              setFilters((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }))
            }
            disabled={(filters.page ?? 1) <= 1}
            className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 disabled:opacity-50"
          >
            ‹
          </button>
          {Array.from({ length: data.meta.pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setFilters((f) => ({ ...f, page: p }))}
              className={`px-3 py-1 rounded ${
                p === data.meta.page
                  ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                  : "border border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() =>
              setFilters((f) => ({
                ...f,
                page: Math.min(data.meta.pages, (f.page ?? 1) + 1),
              }))
            }
            disabled={(filters.page ?? 1) >= data.meta.pages}
            className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 disabled:opacity-50"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/products/${product.id}`} className="block group">
      <Card className="p-0 overflow-hidden hover:shadow-md transition-shadow h-full">
        <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 relative">
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.title}
              className="object-cover w-full h-full group-hover:scale-105 transition-transform"
            />
          ) : (
            <span className="text-xs">No image</span>
          )}
          {product._count?.reviews ? (
            <span className="absolute top-2 right-2">
              <Badge variant="default">
                {product._count.reviews} review
                {product._count.reviews === 1 ? "" : "s"}
              </Badge>
            </span>
          ) : null}
        </div>
        <div className="p-3">
          <h3 className="font-medium truncate text-sm">{product.title}</h3>
          <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
            {product.description}
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-base font-semibold">
              ${product.price.toFixed(2)}
            </span>
            <span className="text-xs text-zinc-500">
              {product.condition} · {product.size}
            </span>
          </div>
          {product.seller && (
            <p className="text-xs text-zinc-500 mt-1">
              Sold by {product.seller.name}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}
