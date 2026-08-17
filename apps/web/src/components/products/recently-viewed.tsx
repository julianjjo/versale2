"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getRecentlyViewedIds, recordProductView } from "@/lib/recently-viewed";
import { ProductCard } from "@/components/products/products-browser";
import type { Product } from "@/lib/types";

// Caps how many of the (already-capped) stored ids get fetched and shown —
// keeping the rail to a single row's worth of products.
const MAX_DISPLAYED = 8;

// Call once from a product detail page to add it to the visitor's history.
// Split from the rendering hook below so a page can record a view without
// necessarily rendering the rail (or vice versa).
export function useRecordProductView(productId: string | undefined): void {
  useEffect(() => {
    if (productId) recordProductView(productId);
  }, [productId]);
}

// Reads localStorage only after mount — during SSR and the first client
// render there's no window, and reading then would either crash or mismatch
// the server-rendered markup (hydration error), so this always starts empty
// and fills in on the client via an effect. The read itself is synchronous
// (no real async gap to guard), so the lint rule below is excused rather
// than worked around — same idiom as the `exhaustive-deps` disable in
// use-debounced-search.ts, just a different rule.
export function useRecentlyViewedIds(excludeId?: string): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIds(getRecentlyViewedIds(excludeId));
  }, [excludeId]);
  return ids;
}

export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const ids = useRecentlyViewedIds(excludeId).slice(0, MAX_DISPLAYED);

  // A single batched request, not one GET /products/:id per id: that
  // per-product endpoint increments the listing's seller-facing view count
  // (see ProductsService#findOne), which would silently inflate it every
  // time a shopper merely glanced at a thumbnail here — this rail reuses the
  // plain catalog listing endpoint instead, which never touches that count.
  const { data } = useQuery<{ data: Product[] }>({
    queryKey: ["products-by-ids", ids],
    queryFn: async () => {
      const res = await api.get<{ data: Product[] }>(
        `/products?ids=${ids.join(",")}&limit=${ids.length}`,
      );
      return res.data;
    },
    enabled: ids.length > 0,
  });

  // The API has no reason to preserve the order of an `id IN (...)` filter,
  // so recency order (most-recently-viewed first) is restored here against
  // `ids` — and a stored id whose product no longer exists or lost approval
  // since it was viewed just isn't in the response, dropped silently rather
  // than breaking the rest of the rail.
  const byId = new Map((data?.data ?? []).map((product) => [product.id, product]));
  const products = ids
    .map((id) => byId.get(id))
    .filter((product): product is Product => Boolean(product));

  if (products.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="heading-section text-text-primary">
        Vistos recientemente
      </h2>
      <div className="products-grid mt-4 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

// A themed wrapper for the homepage specifically: unlike the product detail
// page (already inside a padded PageContainer), the homepage needs its own
// background/vertical-padding/max-width section — which has to stay hidden
// whenever there's no history, same as the rail itself, or it leaves a
// visible blank gap between the surrounding sections. Reads the stored ids
// a second time (cheap, synchronous) rather than threading state down from
// RecentlyViewed, so this wrapper and the rail can't disagree about it.
export function RecentlyViewedSection() {
  const ids = useRecentlyViewedIds();
  if (ids.length === 0) return null;
  return (
    <section className="bg-surface pb-20 lg:pb-32">
      <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8">
        <RecentlyViewed />
      </div>
    </section>
  );
}
