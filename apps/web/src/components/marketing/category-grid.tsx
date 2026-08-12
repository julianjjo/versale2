"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

// The catalog has no fixed taxonomy: sellers type their own category on /sell
// and `/products/facets` reports the ones that actually have approved
// products behind them. Building the tiles from that list (instead of a
// hardcoded set of names with invented piece counts) means every tile lands
// on a filtered catalog view with real results.
const TILE_SPANS = [
  "lg:col-span-5",
  "lg:col-span-4",
  "lg:col-span-3",
  "lg:col-span-3",
  "lg:col-span-5",
  "lg:col-span-4",
];

export function CategoryGrid() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["products-facets"],
    queryFn: async () => {
      const response = await api.get<{ brands: string[]; categories: string[] }>(
        "/products/facets",
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-2">
        <Spinner className="h-5 w-5" /> Cargando categorías…
      </div>
    );
  }

  const categories = (data?.categories ?? []).slice(0, TILE_SPANS.length);

  if (isError || categories.length === 0) {
    return (
      <div className="rounded-[18px] border border-line bg-paper-2 px-6 py-12 text-center">
        <p className="mx-auto max-w-[420px] text-sm leading-[1.6] text-muted-2">
          {isError
            ? "No pudimos cargar las categorías en este momento."
            : "Todavía no hay categorías publicadas. Sube la primera prenda y aparecerá aquí en cuanto un administrador la apruebe."}
        </p>
        <Link
          href={isError ? "/products" : "/sell"}
          className="btn-pill btn-pill-primary mt-6"
        >
          {isError ? "Explorar el catálogo" : "Publicar una prenda"}
          <span className="arrow" aria-hidden>
            →
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-12">
      {categories.map((category, i) => (
        <Link
          key={category}
          href={`/products?category=${encodeURIComponent(category)}`}
          className={`group relative aspect-[1/1.2] overflow-hidden rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${TILE_SPANS[i]}`}
        >
          {/* Placeholder ground first, scrim on top of it, label above both —
              painting the scrim underneath the ground is what left the label
              unreadable at 1.18:1. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-paper-3 transition-transform duration-700 group-hover:scale-105"
          />
          <div aria-hidden className="category-tile-scrim" />
          {/* Clamped to two lines so the label always stays inside the band
              where the scrim is at full strength (9.7:1); the link's
              accessible name still carries the full category. */}
          <div className="absolute inset-x-4 bottom-4 z-10 sm:inset-x-6 sm:bottom-6">
            <h3 className="line-clamp-2 font-display text-[20px] leading-tight tracking-[-0.02em] text-paper sm:text-[26px] lg:text-[30px]">
              {category}
            </h3>
          </div>
        </Link>
      ))}
    </div>
  );
}
