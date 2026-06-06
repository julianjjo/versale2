"use client";

import { useQuery } from "@tanstack/react-query";
import { createApi } from "@/lib/api";
import type { PaginatedResponse, Product } from "@/lib/types";
import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const api = createApi(API_URL);

interface ProductFilters {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  brand?: string;
  condition?: string;
  page?: number;
  limit?: number;
}

export function ProductsBrowser() {
  const [filters, setFilters] = useState<ProductFilters>({ page: 1, limit: 12 });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["products", filters],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Product>>("/products", {
        params: filters,
      });
      return response.data;
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Browse products</h1>

      <form
        className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          setFilters({
            search: String(formData.get("search") ?? "") || undefined,
            minPrice: formData.get("minPrice") ? Number(formData.get("minPrice")) : undefined,
            maxPrice: formData.get("maxPrice") ? Number(formData.get("maxPrice")) : undefined,
            size: String(formData.get("size") ?? "") || undefined,
            condition: String(formData.get("condition") ?? "") || undefined,
            page: 1,
            limit: 12,
          });
        }}
      >
        <input
          name="search"
          placeholder="Search..."
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 sm:col-span-2"
        />
        <input
          name="minPrice"
          type="number"
          placeholder="Min price"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
        />
        <input
          name="maxPrice"
          type="number"
          placeholder="Max price"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
        />
        <button
          type="submit"
          className="rounded-md bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 px-3 py-2 hover:opacity-90"
        >
          Apply
        </button>
        <select
          name="size"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
        >
          <option value="">Any size</option>
          {["XS", "S", "M", "L", "XL"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="condition"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
        >
          <option value="">Any condition</option>
          {["New", "Like New", "Good", "Fair"].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </form>

      {isLoading && <p className="text-zinc-500">Loading…</p>}
      {isError && <p className="text-red-500">Failed to load products.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.data.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            className="block rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:shadow-md transition-shadow"
          >
            <h3 className="font-medium truncate">{product.title}</h3>
            <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{product.description}</p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-lg font-semibold">${product.price.toFixed(2)}</span>
              <span className="text-xs text-zinc-500">
                {product.condition} · Size {product.size}
              </span>
            </div>
            {product.seller && (
              <p className="text-xs text-zinc-500 mt-2">Sold by {product.seller.name}</p>
            )}
          </Link>
        ))}
      </div>

      {data && data.meta.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
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
        </div>
      )}
    </div>
  );
}
