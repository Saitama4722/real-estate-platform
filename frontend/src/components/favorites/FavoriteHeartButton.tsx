"use client";

import { useFavorites } from "@/lib/favorites";
import { cn } from "@/lib/utils";

interface FavoriteHeartButtonProps {
  /** Property identifier stored in favorites (the property slug). */
  favoriteId: string;
  className?: string;
}

/**
 * Heart toggle rendered over a property card image. Toggling is local-only and
 * optimistic (no loading state). It stops the click from bubbling to the card's
 * wrapping <Link>, so favoriting never navigates to the property page.
 */
export function FavoriteHeartButton({ favoriteId, className }: FavoriteHeartButtonProps) {
  const { isFavorite, toggleFavorite, ready } = useFavorites();
  const active = isFavorite(favoriteId);

  const onClick = (e: React.MouseEvent) => {
    // Cards are wrapped in / contain a <Link>; never navigate on a heart click.
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(favoriteId);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      // Before hydration the true state is unknown; render as not-active but
      // keep the control usable — the effect in the provider fills state in.
      aria-pressed={ready ? active : false}
      aria-label={active ? "Убрать из избранного" : "Добавить в избранное"}
      title={active ? "Убрать из избранного" : "Добавить в избранное"}
      className={cn(
        // 44px per the catalog mockup's corner controls (also the minimum
        // comfortable touch target); was 36px.
        "inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-sm backdrop-blur-sm transition-colors",
        "hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
        active && "text-red-500",
        className,
      )}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
