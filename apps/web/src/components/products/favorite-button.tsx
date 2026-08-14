"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useFavoriteProductIds, useToggleFavorite } from "@/lib/favorites";

export function FavoriteButton({
  productId,
  className = "",
}: {
  productId: string;
  className?: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const favoriteProductIds = useFavoriteProductIds();
  const toggleFavorite = useToggleFavorite();
  const isFavorite = favoriteProductIds.has(productId);

  const handleClick = (e: React.MouseEvent) => {
    // ProductCard wraps this button in a Link to the product page; without
    // these the click would both toggle the favorite and navigate away.
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push(
        `/login?next=${encodeURIComponent(`/products/${productId}`)}&reason=favorite`,
      );
      return;
    }
    toggleFavorite.mutate({ productId, isFavorite });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={toggleFavorite.isPending}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-text-primary shadow-sm backdrop-blur transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <HeartIcon filled={isFavorite} />
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={filled ? "text-danger" : "text-text-primary"}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
