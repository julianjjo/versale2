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

// One source of truth for the valid `sortBy` values and their labels, so the
// URL parser, the submit handler, and the <Select>'s options can't drift out
// of sync with each other the way three independently hand-written literals
// would — the same reason CONDITION_OPTIONS exists below for `condition`.
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
  // Not URL-driven like the fields above — always supplied as a fixed
  // `initialFilters.sellerId` by a seller's public profile page, never
  // parsed from or written to the query string (see `queryFromFilters`).
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
  const headingRef = useRef<HTMLDivElement>(null);

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
      // keepPreviousData deja la grilla anterior visible; mover foco al listado
      headingRef.current?.focus();
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
    // foco al listado para lectores + usuario teclado tras paginar
    requestAnimationFrame(() => headingRef.current?.focus());
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
    // Keeps any fixed filter a host page supplies (e.g. a seller profile
    // page's `sellerId`) — this resets what the visitor searched for, not
    // which catalog they're even looking at.
    applyFilters({ page: 1, limit, ...initialFilters });
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
              sortBy: isSortByValue(form.sortBy) ? form.sortBy : undefined,
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
            {/* Item 5 closed list: same options the API's DTO accepts, so the
                filter can never produce a query that returns nothing by
                construction. Facets are no longer needed here — the list is
                fixed, not data-driven. */}
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            name="sortBy"
            value={form.sortBy}
            onChange={(e) =>
              setForm((f) => ({ ...f, sortBy: e.target.value }))
            }
            aria-label="Ordenar por"
            // Matches the search input's span: the 7 filter fields before it
            // fill exactly 8 one-unit grid cells (2 breakpoints' worth of full
            // rows), so a single-unit 9th field would leave the row before the
            // button bar mostly empty. Spanning 2 keeps sm's rows full and
            // narrows (rather than widens) the gap on lg.
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
          {/* A 429 from this endpoint's own throttle carries a specific,
              friendly message from the backend (see PRODUCTS_SEARCH_THROTTLE_*
              in products.controller.ts) — surfacing it instead of the generic
              fallback also stops the copy from inviting the immediate retry
              that would just trip the same limit again. */}
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
        ref={headingRef}
        tabIndex={-1}
        aria-busy={isFetching}
        data-testid="products-grid"
        className="products-grid grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 outline-none"
      >
        {data?.data.map((product, index) => (
          <ProductCard key={product.id} product={product} priority={index < 4} />
        ))}
      </div>
      {data && data.meta.pages > 1 && (
        <p aria-live="polite" role="status" className="sr-only">
          Mostrando página {filters.page ?? 1} de {data.meta.pages}
        </p>
      )}

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
  // Forwarded to `FavoriteButton` — see its own doc comment. Lets a caller
  // that already knows every card it renders is a favorite (the Favoritos
  // page) skip that button's membership lookup.
  isFavoriteOverride?: boolean;
  // Set by the caller for cards it knows render above the fold (e.g. the
  // first row of the main catalog grid), so next/image preloads them instead
  // of lazy-loading — those are the images actually competing for LCP.
  priority?: boolean;
}) {
  const { user } = useAuth();
  const isOwn = user?.id === product.sellerId;

  // Item 14: el botón de favorito es HERMANO posicionado del <Link>, no un
  // descendiente — un botón dentro de un enlace es HTML inválido (los
  // lectores de pantalla lo anuncian mal) y una fuente clásica de errores
  // de hidratación.
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
            {/* Only reachable via the Favoritos page: the public catalog's own
                findAll already excludes anything not approved/unpaused/sold,
                but a Favorite row survives its product later being rejected,
                paused, or sold (see favorites.service.ts), so this card still
                has to tell those states apart there. Sold takes priority —
                mirrors mis-productos/page.tsx's own isSold-first badge order
                — since it's the one state that can never revert. */}
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
