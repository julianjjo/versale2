"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import {
  CONDITION_OPTIONS,
  conditionLabel,
} from "@/lib/product-condition";
import type { PaginatedResponse, Product } from "@/lib/types";
import { Suspense, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Spinner,
  EmptyState,
  Button,
  Price,
  Input,
  Select,
  Badge,
  StarRating,
} from "@/components/ui";
import { Pager } from "@/components/admin/pager";
import { FavoriteButton } from "@/components/products/favorite-button";
import { useAuth } from "@/lib/auth";
import { PRODUCT_CATEGORIES } from "@/lib/categories";
import { formatPublishDate } from "@/lib/format-date";

const SORT_OPTIONS = [
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
  { value: "most_viewed", label: "Más vistos" },
  { value: "most_favorited", label: "Más favoritos" },
  { value: "top_rated", label: "Mejor valorados" },
] as const;

type SortByValue = (typeof SORT_OPTIONS)[number]["value"];

function isSortByValue(value: string): value is SortByValue {
  return SORT_OPTIONS.some((option) => option.value === value);
}

export interface ProductFilters {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  brand?: string;
  condition?: string;
  category?: string;
  sellerId?: string;
  sortBy?: SortByValue;
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

interface FilterFormState {
  search: string;
  minPrice: string;
  maxPrice: string;
  size: string;
  brand: string;
  category: string;
  condition: string;
  sortBy: string;
}

const EMPTY_FORM: FilterFormState = {
  search: "",
  minPrice: "",
  maxPrice: "",
  size: "",
  brand: "",
  category: "",
  condition: "",
  sortBy: "",
};

function toFormState(f?: ProductFilters): FilterFormState {
  return {
    search: f?.search ?? "",
    minPrice: f?.minPrice != null ? String(f.minPrice) : "",
    maxPrice: f?.maxPrice != null ? String(f.maxPrice) : "",
    size: f?.size ?? "",
    brand: f?.brand ?? "",
    category: f?.category ?? "",
    condition: f?.condition ?? "",
    sortBy: f?.sortBy ?? "",
  };
}

function mergeFacetOptions(fetched: string[] | undefined, current: string): string[] {
  const options = fetched ?? [];
  return current && !options.includes(current) ? [current, ...options] : options;
}

function parseAmount(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function parsePage(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : undefined;
}

function filtersFromQuery(
  params: URLSearchParams,
  limit: number,
  base?: ProductFilters,
): ProductFilters {
  const filters: ProductFilters = { page: 1, limit, ...base };
  const search = params.get("search")?.trim();
  if (search) filters.search = search;
  const minPrice = parseAmount(params.get("minPrice"));
  if (minPrice !== undefined) filters.minPrice = minPrice;
  const maxPrice = parseAmount(params.get("maxPrice"));
  if (maxPrice !== undefined) filters.maxPrice = maxPrice;
  for (const key of ["size", "brand", "category", "condition"] as const) {
    const value = params.get(key)?.trim();
    if (value) filters[key] = key === "size" ? value.toUpperCase() : value;
  }
  const sortBy = params.get("sortBy")?.trim() ?? "";
  if (isSortByValue(sortBy)) filters.sortBy = sortBy;
  filters.page = parsePage(params.get("page")) ?? filters.page ?? 1;
  return filters;
}

function queryFromFilters(filters: ProductFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.minPrice != null) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice != null) params.set("maxPrice", String(filters.maxPrice));
  if (filters.size) params.set("size", filters.size);
  if (filters.condition) params.set("condition", filters.condition);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.category) params.set("category", filters.category);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if ((filters.page ?? 1) > 1) params.set("page", String(filters.page));
  return params.toString();
}

function ProductsLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
      <Spinner className="h-5 w-5" /> Cargando productos…
    </div>
  );
}

export function ProductsBrowser(props: ProductsBrowserProps) {
  return (
    <Suspense fallback={<ProductsLoading />}>
      <ProductsBrowserContent {...props} />
    </Suspense>
  );
}

function ProductsBrowserContent({
  initialFilters,
  limit = 12,
  showFilters = true,
  showPagination = true,
}: ProductsBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gridRef = useRef<HTMLDivElement>(null);

  const ownsUrl = showFilters || showPagination;
  const query = searchParams?.toString() ?? "";

  const urlFilters = useMemo(
    () => filtersFromQuery(new URLSearchParams(query), limit, initialFilters),
    [query, limit, initialFilters],
  );
  const [localFilters, setLocalFilters] = useState<ProductFilters>(() => ({
    page: 1,
    limit,
    ...initialFilters,
  }));
  const filters = ownsUrl ? urlFilters : localFilters;

  const appliedForm = toFormState(filters);
  const appliedSignature = JSON.stringify(appliedForm);
  const [form, setForm] = useState<FilterFormState>(appliedForm);
  const [syncedSignature, setSyncedSignature] = useState(appliedSignature);
  if (syncedSignature !== appliedSignature) {
    setSyncedSignature(appliedSignature);
    setForm(appliedForm);
  }

  const applyFilters = (next: ProductFilters) => {
    if (!ownsUrl) {
      setLocalFilters(next);
      requestAnimationFrame(() => gridRef.current?.focus());
      return;
    }
    const nextQuery = queryFromFilters(next);
    if (nextQuery === query) return;
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
    requestAnimationFrame(() => gridRef.current?.focus());
  };

  const { data, isLoading, isFetching, isError, error } = useQuery({
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
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const { data: facets } = useQuery({
    queryKey: ["products-facets"],
    queryFn: async () => {
      const response = await api.get<{
        brands: string[];
        categories: { name: string; count: number }[];
      }>("/products/facets");
      return response.data;
    },
    enabled: showFilters,
    staleTime: 5 * 60 * 1000,
  });

  const clearFilters = () => {
    setForm(EMPTY_FORM);
    applyFilters({ page: 1, limit, ...initialFilters });
  };

  return (
    <div>
      {showFilters && (
        <form
          aria-label="Filtrar el catálogo"
          className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-border bg-surface-muted p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters({
              ...filters,
              search: form.search || undefined,
              minPrice: form.minPrice ? Number(form.minPrice) : undefined,
              maxPrice: form.maxPrice ? Number(form.maxPrice) : undefined,
              size: form.size || undefined,
              brand: form.brand || undefined,
              category: form.category || undefined,
              condition: form.condition || undefined,
              sortBy: isSortByValue(form.sortBy) ? form.sortBy : undefined,
              page: 1,
            });
          }}
        >
          <Input
            name="search"
            label="Buscar"
            placeholder="Chaqueta de jean, Levi's…"
            value={form.search}
            onChange={(e) =>
              setForm((f) => ({ ...f, search: e.target.value }))
            }
            wrapperClassName="sm:col-span-2 lg:col-span-2"
          />
          <Input
            name="minPrice"
            label="Precio mínimo"
            type="number"
            min={0}
            step="1000"
            value={form.minPrice}
            onChange={(e) =>
              setForm((f) => ({ ...f, minPrice: e.target.value }))
            }
          />
          <Input
            name="maxPrice"
            label="Precio máximo"
            type="number"
            min={0}
            step="1000"
            value={form.maxPrice}
            onChange={(e) =>
              setForm((f) => ({ ...f, maxPrice: e.target.value }))
            }
          />
          <Select
            name="size"
            label="Talla"
            value={form.size}
            onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
          >
            <option value="">Cualquiera</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            name="condition"
            label="Condición"
            value={form.condition}
            onChange={(e) =>
              setForm((f) => ({ ...f, condition: e.target.value }))
            }
          >
            <option value="">Cualquiera</option>
            {CONDITION_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <Select
            name="brand"
            label="Marca"
            value={form.brand}
            onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
          >
            <option value="">Cualquiera</option>
            {mergeFacetOptions(facets?.brands, form.brand).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
          <Select
            name="category"
            label="Categoría"
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value }))
            }
          >
            <option value="">Cualquiera</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            name="sortBy"
            label="Ordenar por"
            value={form.sortBy}
            onChange={(e) =>
              setForm((f) => ({ ...f, sortBy: e.target.value }))
            }
            wrapperClassName="sm:col-span-2 lg:col-span-2"
          >
            <option value="">Más recientes</option>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end lg:col-span-4">
            <Button
              type="button"
              variant="ghost"
              onClick={clearFilters}
              className="w-full sm:w-auto"
            >
              Limpiar filtros
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              Aplicar filtros
            </Button>
          </div>
        </form>
      )}

      {isLoading && !data && (
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando productos…
        </div>
      )}
      {isError && (
        <div className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {extractApiError(
            error,
            "No pudimos cargar los productos. Intenta de nuevo.",
          )}
        </div>
      )}

      {data && data.data.length === 0 && !isLoading && (
        <EmptyState
          title="No encontramos productos"
          description={
            showFilters
              ? "Ajusta los filtros o explora todas las publicaciones."
              : "Todavía no hay publicaciones activas aquí."
          }
          action={
            showFilters ? (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : undefined
          }
        />
      )}

      <div
        ref={gridRef}
        tabIndex={-1}
        aria-busy={isFetching ? "true" : "false"}
        data-testid="products-grid"
        className="products-grid grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        {data?.data.map((product, index) => (
          <ProductCard key={product.id} product={product} priority={index < 4} />
        ))}
      </div>
      <p aria-live="polite" role="status" className="sr-only">
        {data?.meta.pages && data.meta.pages > 1 ? `Mostrando página ${filters.page ?? 1} de ${data.meta.pages}` : ""}
      </p>

      {showPagination && data && data.meta.pages > 1 && (
        <nav aria-label="Paginación">
          <Pager
            page={filters.page ?? 1}
            pages={data.meta.pages}
            isFetching={isFetching}
            onPageChange={(p) => applyFilters({ ...filters, page: p })}
          />
        </nav>
      )}
    </div>
  );
}


export function ProductCard({
  product,
  isFavoriteOverride,
  priority = false,
}: {
  product: Product;
  isFavoriteOverride?: boolean;
  priority?: boolean;
}) {
  const { user } = useAuth();
  const isOwn = user?.id === product.sellerId;

  return (
    <div className="relative h-full rounded-[14px] focus-within:outline-none focus-within:ring-2 focus-within:ring-text-primary focus-within:ring-offset-2 focus-within:ring-offset-surface [&:has(:focus-visible)]:ring-2 [&:has(:focus-visible)]:ring-text-primary [&:has(:focus-visible)]:ring-offset-2 [&:has(:focus-visible)]:ring-offset-surface">
      <Link
        href={`/products/${product.id}`}
        className="group block h-full rounded-[14px] outline-none"
      >
        <article className="flex h-full flex-col gap-3.5 transition-transform duration-300 group-hover:-translate-y-1">
          <div className="relative aspect-[3/4] overflow-hidden rounded-[14px] bg-paper-3">
            {product.images?.[0] ? (
              <Image
                src={product.images[0].url}
                alt={product.title}
                fill
                sizes="(min-width: 1024px) 23vw, (min-width: 640px) 31vw, 46vw"
                priority={priority}
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                Sin imagen
              </div>
            )}
            {product.status === "SOLD" ? (
              <Badge
                variant="warning"
                className="absolute left-3 top-3 z-10 uppercase tracking-[0.1em]"
              >
                Vendido
              </Badge>
            ) : !product.isApproved ? (
              <Badge
                variant="warning"
                className="absolute left-3 top-3 z-10 uppercase tracking-[0.1em]"
              >
                Pendiente
              </Badge>
            ) : (
              product.pausedAt && (
                <Badge
                  variant="warning"
                  className="absolute left-3 top-3 z-10 uppercase tracking-[0.1em]"
                >
                  Pausado
                </Badge>
              )
            )}
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
            {product.averageRating != null && (
              <div className="mt-0.5 flex items-center gap-1.5">
                <StarRating value={product.averageRating} />
                <span className="text-[11px] text-muted">
                  {product.averageRating.toFixed(1)}
                  {product._count && ` (${product._count.reviews})`}
                </span>
              </div>
            )}
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <Price value={product.price} className="text-[16px] sm:text-[18px]" />
              <span className="text-[11px] text-muted">
                Talla {product.size} · {conditionLabel(product.condition)}
              </span>
            </div>
            {product.seller && (
              <p className="mt-1 text-[11px] text-muted">
                Vendido por {product.seller.name}
              </p>
            )}
            <p className="text-[11px] text-muted">
              {formatPublishDate(product.createdAt)}
            </p>
          </div>
        </article>
      </Link>
      {!isOwn && (
        <FavoriteButton
          productId={product.id}
          className="absolute right-3 top-3 z-20"
          isFavoriteOverride={isFavoriteOverride}
        />
      )}
    </div>
  );
}