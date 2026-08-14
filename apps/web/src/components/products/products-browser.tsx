"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  CONDITION_OPTIONS,
  conditionLabel,
} from "@/lib/product-condition";
import type { PaginatedResponse, Product } from "@/lib/types";
import { Suspense, useMemo, useState } from "react";
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
} from "@/components/ui";
import { Pager } from "@/components/admin/pager";
import { FavoriteButton } from "@/components/products/favorite-button";

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

interface FilterFormState {
  search: string;
  minPrice: string;
  maxPrice: string;
  size: string;
  brand: string;
  category: string;
  condition: string;
}

const EMPTY_FORM: FilterFormState = {
  search: "",
  minPrice: "",
  maxPrice: "",
  size: "",
  brand: "",
  category: "",
  condition: "",
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
  };
}

// Always includes the currently-selected value even if it hasn't loaded from
// the facets endpoint yet, so the <select> never silently drops the user's
// current choice while `facets` is loading or stale.
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

// The query string is the source of truth for the applied filters, so a
// catalog view can be shared, bookmarked and restored with Back/Forward.
// `limit` never travels in the URL — it's a layout decision of the host page,
// not something the visitor picks.
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
    if (value) filters[key] = value;
  }
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

// `useSearchParams` needs a Suspense boundary in the App Router. Keeping it
// here (instead of in every page that renders the browser) means the home page
// and the marketplace both get one without changing their own layout.
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

  // Embedded uses (the home page grid) show a fixed slice of the catalog and
  // must not rewrite the URL of the page hosting them; only the browsable
  // marketplace view owns the query string.
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
  // The applied filters can change from outside the form — a shared link, the
  // Back/Forward buttons, "Limpiar filtros". Re-seed the visible fields when
  // that happens (a page change alone never touches the draft).
  if (syncedSignature !== appliedSignature) {
    setSyncedSignature(appliedSignature);
    setForm(appliedForm);
  }

  const applyFilters = (next: ProductFilters) => {
    if (!ownsUrl) {
      setLocalFilters(next);
      return;
    }
    const nextQuery = queryFromFilters(next);
    // Re-applying the same filters would only pile up history entries and turn
    // Back into a trap.
    if (nextQuery === query) return;
    // Nothing here fires per keystroke — filters land only when the form is
    // submitted or the page changes, so each entry in the history is a
    // deliberate step the visitor expects Back to undo.
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  };

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

  const { data: facets } = useQuery({
    queryKey: ["products-facets"],
    queryFn: async () => {
      const response = await api.get<{ brands: string[]; categories: string[] }>(
        "/products/facets",
      );
      return response.data;
    },
    enabled: showFilters,
    staleTime: 5 * 60 * 1000,
  });

  const clearFilters = () => {
    setForm(EMPTY_FORM);
    applyFilters({ page: 1, limit });
  };

  return (
    <div>
      {showFilters && (
        <form
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
              page: 1,
            });
          }}
        >
          <Input
            name="search"
            placeholder="Buscar prendas, marcas…"
            value={form.search}
            onChange={(e) =>
              setForm((f) => ({ ...f, search: e.target.value }))
            }
            wrapperClassName="sm:col-span-2 lg:col-span-2"
            aria-label="Buscar productos"
          />
          <Input
            name="minPrice"
            type="number"
            min={0}
            step="1000"
            placeholder="Precio mín."
            value={form.minPrice}
            onChange={(e) =>
              setForm((f) => ({ ...f, minPrice: e.target.value }))
            }
            aria-label="Precio mínimo"
          />
          <Input
            name="maxPrice"
            type="number"
            min={0}
            step="1000"
            placeholder="Precio máx."
            value={form.maxPrice}
            onChange={(e) =>
              setForm((f) => ({ ...f, maxPrice: e.target.value }))
            }
            aria-label="Precio máximo"
          />
          <Select
            name="size"
            value={form.size}
            onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
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
            value={form.condition}
            onChange={(e) =>
              setForm((f) => ({ ...f, condition: e.target.value }))
            }
            aria-label="Filtrar por condición"
          >
            <option value="">Cualquier condición</option>
            {CONDITION_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <Select
            name="brand"
            value={form.brand}
            onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
            aria-label="Filtrar por marca"
          >
            <option value="">Cualquier marca</option>
            {mergeFacetOptions(facets?.brands, form.brand).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
          <Select
            name="category"
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value }))
            }
            aria-label="Filtrar por categoría"
          >
            <option value="">Cualquier categoría</option>
            {mergeFacetOptions(facets?.categories, form.category).map((c) => (
              <option key={c} value={c}>
                {c}
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
            <Button variant="secondary" size="sm" onClick={clearFilters}>
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
        <nav aria-label="Paginación">
          <Pager
            page={filters.page ?? 1}
            pages={data.meta.pages}
            onPageChange={(p) => applyFilters({ ...filters, page: p })}
          />
        </nav>
      )}
    </div>
  );
}


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
          <FavoriteButton
            productId={product.id}
            className="absolute right-3 top-3 z-10"
          />
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
        </div>
      </article>
    </Link>
  );
}
