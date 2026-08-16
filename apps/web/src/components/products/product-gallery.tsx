"use client";

import { useState } from "react";

// Selection lives here, not in ProductDetail: the caller remounts this
// component (via a `key` covering both the product id and the images
// themselves — see the doc comment at the call site) whenever the picture
// set changes, so `selectedIndex` never needs to be reconciled against a
// content change under a stable id. That would otherwise be a real bug: an
// index-based selection surviving a same-id refetch (e.g. after posting a
// review invalidates the product query) has no way to tell "still the same
// photo at this position" from "a different photo now happens to be here" —
// remounting sidesteps the question entirely by always starting fresh.
export function ProductGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeImage = images[selectedIndex];

  return (
    <div className="space-y-2">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-muted">
        {activeImage ? (
          <img
            src={activeImage}
            alt={title}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-sm text-text-muted">Sin imagen</span>
        )}
      </div>
      {/* Thumbnail highlighting is visual only (border + aria-current, not
          announced on its own) — this gives screen-reader users the same
          "you're now looking at photo N" confirmation a sighted user gets
          from watching the main image swap. */}
      <div aria-live="polite" role="status" className="sr-only">
        {images.length > 0
          ? `Foto ${selectedIndex + 1} de ${images.length}`
          : ""}
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              aria-current={idx === selectedIndex}
              aria-label={`Ver foto ${idx + 1} de ${title}`}
              className={`aspect-square overflow-hidden rounded-md border bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                idx === selectedIndex
                  ? "border-text-primary ring-2 ring-text-primary"
                  : "border-border"
              }`}
            >
              <img
                src={img}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
