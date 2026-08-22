"use client";

import { useState } from "react";
import Image from "next/image";
import { Modal } from "../ui/modal";
import type { ProductImage } from "@/lib/types";

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
  images: ProductImage[];
  title: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const activeImage = images[selectedIndex];
  // The listing title is the fallback alt when a photo somehow lacks one; the
  // API requires alt now, so this only shields legacy rows mid-migration.
  const activeAlt = activeImage?.alt || title;

  return (
    <div className="space-y-2">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-muted">
        {activeImage ? (
          <Image
            src={activeImage.url}
            alt={activeAlt}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            priority
            className="object-cover"
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
      {activeImage && (
        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Ampliar imagen
        </button>
      )}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((img, idx) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              aria-current={idx === selectedIndex}
              aria-label={`Ver foto ${idx + 1} de ${title}`}
              className={`relative aspect-square overflow-hidden rounded-md border bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                idx === selectedIndex
                  ? "border-text-primary ring-2 ring-text-primary"
                  : "border-border"
              }`}
            >
              <Image
                src={img.url}
                alt=""
                fill
                sizes="(min-width: 768px) 140px, 22vw"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
      {activeImage && (
        <Modal open={zoomOpen} onClose={() => setZoomOpen(false)} title={activeAlt}>
          {/* Decorative inside the dialog: the modal's aria-labelledby already
              names the content with the photo's alt text. Plain img, not
              next/image: it sizes itself to the photo's own aspect ratio via
              max-h-[80vh]/object-contain, and next/image's `fill` needs a
              parent with a predetermined size, which would force every photo
              into the same box regardless of its actual proportions. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeImage.url}
            alt=""
            className="max-h-[80vh] w-full rounded-md object-contain"
          />
        </Modal>
      )}
    </div>
  );
}
