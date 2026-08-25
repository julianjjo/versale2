"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginRedirectUrl, useAuth } from "@/lib/auth";
import { useFavoriteProductIds, useToggleFavorite } from "@/lib/favorites";

export function FavoriteButton({
  productId,
  className = "",
  isFavoriteOverride,
}: {
  productId: string;
  className?: string;
  // The Favoritos page already knows every card it renders is a favorite —
  // passing that ground truth here skips the membership lookup entirely
  // instead of firing a redundant `/favorites/ids` request whose answer is
  // already known (and, for a moment before it resolved, would otherwise
  // flash every heart on that page as unfavorited).
  isFavoriteOverride?: boolean;
}) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const favoriteProductIds = useFavoriteProductIds({
    enabled: isFavoriteOverride === undefined,
  });
  const toggleFavorite = useToggleFavorite();
  const isFavorite = isFavoriteOverride ?? favoriteProductIds.has(productId);
  const [error, setError] = useState<string | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    // ProductCard wraps this button in a Link to the product page; without
    // these the click would both toggle the favorite and navigate away.
    e.preventDefault();
    e.stopPropagation();

    // AuthProvider starts as `{ user: null, isLoading: true }` while it
    // verifies a persisted token — treating that as "logged out" would
    // wrongly redirect an already-authenticated visitor who clicks during
    // that brief startup window.
    if (isAuthLoading) return;

    if (!user) {
      router.push(loginRedirectUrl(productId, "favorite"));
      return;
    }

    setError(null);
    toggleFavorite.mutate(
      { productId, isFavorite },
      {
        onError: () =>
          setError(
            isFavorite
              ? "No pudimos quitar el producto de favoritos"
              : "No pudimos agregar el producto a favoritos",
          ),
      },
    );
  };

  return (
    <span className="relative inline-flex flex-col items-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={toggleFavorite.isPending || isAuthLoading}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
        className={`inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface/90 text-text-primary shadow-sm backdrop-blur transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        <HeartIcon filled={isFavorite} />
      </button>
      {error && (
        <>
          <span className="sr-only" aria-live="assertive">
            {error}
          </span>
          <span role="alert" className="mt-1 max-w-[12rem] whitespace-normal text-center text-xs text-danger">
            {error}
          </span>
        </>
      )}
    </span>
  );
}

export function HeartIcon({
  filled = false,
  size = 20,
}: {
  filled?: boolean;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      // `--color-danger` is reserved for destructive actions/errors (see
      // design.md); a filled heart is a positive selection, not a warning,
      // so it uses the brand accent instead.
      className={filled ? "text-terracotta-deep" : "text-text-primary"}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
