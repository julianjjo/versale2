"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Modal } from "../ui/modal";
import type { ProductImage } from "@/lib/types";

export function ProductGallery({
  images,
  title,
}: {
  images: ProductImage[];
  title: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  useEffect(() => {
    if (selectedIndex >= images.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync selectedIndex when product changes to different image count
      setSelectedIndex(0);
    }
  }, [images, selectedIndex]);
  const activeImage = images[selectedIndex];
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
              key={`${img.url}-${idx}`}
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
        <Modal
          open={zoomOpen}
          onClose={() => setZoomOpen(false)}
          title={activeAlt}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeImage.url}
            alt={activeAlt}
            className="max-h-[80vh] w-full rounded-md object-contain"
          />
        </Modal>
      )}
    </div>
  );
}
