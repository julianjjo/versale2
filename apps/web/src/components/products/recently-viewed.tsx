"use client";

import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
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
// and fills in on the client via an effect. Deferred a tick (matching the
// async-effect pattern in auth.tsx's profile fetch) rather than calling
// setState synchronously in the effect body.
function useRecentlyViewedIds(excludeId?: string): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIds(getRecentlyViewedIds(excludeId));
    });
    return () => {
      cancelled = true;
    };
  }, [excludeId]);
  return ids;
}

export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const ids = useRecentlyViewedIds(excludeId).slice(0, MAX_DISPLAYED);

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["product", id],
      queryFn: async () => {
        const res = await api.get<Product>(`/products/${id}`);
        return res.data;
      },
      // A listing removed, unapproved, or otherwise inaccessible since it was
      // last viewed should just drop out of the rail, not retry or block it.
      retry: false,
    })),
  });

  const products = results
    .map((result) => result.data)
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
