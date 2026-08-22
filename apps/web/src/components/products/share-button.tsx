"use client";

import { useState } from "react";

export function ShareButton({
  productId,
  title,
  className = "",
  onCopied,
  onError,
}: {
  productId: string;
  title: string;
  className?: string;
  // Feedback is left to the caller rather than managed here, so it reuses
  // whatever success/error banner convention the page already has instead
  // of this button inventing its own.
  onCopied: () => void;
  onError: (message: string) => void;
}) {
  // Same reasoning as FavoriteButton's own pending-disable: without it, a
  // fast double-click can fire the share sheet or the clipboard write
  // twice before the first one resolves.
  const [isSharing, setIsSharing] = useState(false);

  const handleClick = async () => {
    setIsSharing(true);
    try {
      // Built here (inside the click handler — always client-side) instead
      // of off the current address bar: the current page can be a
      // `?preview=1` admin/seller preview link, which isn't the URL a
      // recipient should land on.
      const url = `${window.location.origin}/products/${productId}`;

      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title, url });
        } catch {
          // The visitor dismissed the native share sheet, or the browser
          // refused for some other reason — either way this isn't a
          // failure of the click itself, just a share that didn't
          // complete, so there's nothing to report and no clipboard
          // fallback to fall back to (the visitor already made a choice
          // via the native UI).
        }
        return;
      }

      try {
        await navigator.clipboard.writeText(url);
        onCopied();
      } catch {
        onError("No pudimos copiar el enlace");
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isSharing}
      aria-label="Compartir esta publicación"
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface/90 text-text-primary shadow-sm backdrop-blur transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <ShareIcon />
    </button>
  );
}

function ShareIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
