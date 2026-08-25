"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { DEFAULT_PRODUCT_CATEGORY } from "@/lib/categories";

type CategoryFacet = { name: string; count: number };

const MAX_TILES = 6;

// Versale has no art-directed photography and never will: the only images that
// can ever exist are garments photographed by the people who own them, and the
// catalog is empty before launch. So these tiles are built to be complete
// without an image — they hang from a rail instead of framing a picture. See
// the `.drop` block in globals.css.
//
// Per tile: a width, a length, a stem and a tone. The four vary together so the
// row reads as garments of different cuts on one rail rather than a card grid;
// equal values would collapse it back into the placeholder rectangles this
// replaced.
const TILE_SHAPES = [
  { grow: "lg:flex-[1.3]", height: "h-[300px] lg:h-[380px]", stem: "[--stem:28px]" },
  { grow: "lg:flex-[1]", height: "h-[260px] lg:h-[300px]", stem: "[--stem:56px]" },
  { grow: "lg:flex-[0.85]", height: "h-[320px] lg:h-[420px]", stem: "[--stem:20px]" },
  { grow: "lg:flex-[0.85]", height: "h-[260px] lg:h-[320px]", stem: "[--stem:64px]" },
  { grow: "lg:flex-[1.3]", height: "h-[300px] lg:h-[360px]", stem: "[--stem:40px]" },
  { grow: "lg:flex-[1]", height: "h-[280px] lg:h-[400px]", stem: "[--stem:24px]" },
];

// Alternating tones give the rail its rhythm without spending the single brand
// accent six times over. Ink lands on tiles 1, 3 and 5, which under the widths
// above puts a dark tile at each end of the row and one in the middle.
function toneFor(index: number) {
  return index % 2 === 0
    ? { form: "bg-ink", title: "text-paper", count: "text-paper/70" }
    : { form: "bg-paper-2", title: "text-ink", count: "text-muted-2" };
}

function pieceLabel(count: number) {
  return count === 1 ? "1 prenda" : `${count} prendas`;
}

export function CategoryGrid() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["products-facets"],
    queryFn: async () => {
      const response = await api.get<{
        brands: string[];
        categories: CategoryFacet[];
      }>("/products/facets");
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // `isPending`, not `isLoading`: between retry attempts `isLoading` dips to
  // false while `data` is still undefined, and the old `isError || length === 0`
  // condition used that window to tell visitors "todavía no hay categorías
  // publicadas" — an empty catalog — when the API was simply unreachable. Two
  // very different messages for a marketplace, so the states are now split.
  if (isPending) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-2">
        <Spinner className="h-5 w-5" /> Cargando categorías…
      </div>
    );
  }

  if (isError) {
    return (
      <Fallback
        body="No pudimos cargar las categorías en este momento."
        href="/products"
        cta="Explorar el catálogo"
      />
    );
  }

  // The endpoint already orders by listing count, so the six with the most
  // stock get the tiles. "Otros" is the backfill bucket for anything that
  // didn't fit the closed list — a real filter value, but not something to
  // advertise as a category worth browsing, so it never takes a tile even
  // when it ranks.
  const categories = data.categories
    .filter((c) => c.name !== DEFAULT_PRODUCT_CATEGORY && c.count > 0)
    .slice(0, MAX_TILES);

  if (categories.length === 0) {
    return (
      <Fallback
        body="Todavía no hay categorías publicadas. Sube la primera prenda y aparecerá aquí en cuanto un administrador la apruebe."
        href="/sell"
        cta="Publicar una prenda"
      />
    );
  }

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-10 sm:gap-x-5 lg:flex-nowrap">
      {categories.map((category, i) => {
        const shape = TILE_SHAPES[i % TILE_SHAPES.length];
        const tone = toneFor(i);
        return (
          <li
            key={category.name}
            className={`drop w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.834rem)] lg:w-auto ${shape.grow} ${shape.stem}`}
          >
            <Link
              href={`/products?category=${encodeURIComponent(category.name)}`}
              className="drop-lift block rounded-b-[18px] outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              {/* Squared shoulder, soft hem, label at the top where a tag sits
                  on a hanger — which is what retires the scrim this tile used
                  to need. That gradient existed only to rescue bottom-anchored
                  text laid over a photograph; with the label on its own solid
                  ground there is nothing left for it to do. */}
              <div
                className={`drop-form flex flex-col justify-between px-5 py-5 sm:px-6 sm:py-6 ${shape.height} ${tone.form}`}
              >
                <h3
                  className={`font-display text-[20px] leading-tight tracking-[-0.02em] sm:text-[26px] lg:text-[30px] ${tone.title}`}
                >
                  {category.name}
                </h3>
                <span className={`text-[13px] ${tone.count}`}>
                  {pieceLabel(category.count)}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// Both fallbacks hang from the same rail as the tiles they stand in for, so an
// empty or unreachable catalog still reads as part of the composition rather
// than as a hole where the row should be.
function Fallback({
  body,
  href,
  cta,
}: {
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="drop max-w-[520px] [--stem:32px]">
      <div className="drop-form bg-paper-2 px-8 py-10">
        <p className="max-w-[420px] text-sm leading-[1.6] text-muted-2">{body}</p>
        <Link href={href} className="btn-pill btn-pill-primary mt-7">
          {cta}
          <span className="arrow" aria-hidden>
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
