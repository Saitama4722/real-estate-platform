"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Heart } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/lib/favorites";
import { useCompare } from "@/lib/compare";
import type { ComparePropertyType } from "@/lib/compare";

/**
 * Labelled favourite / compare toggles for the property page title row.
 *
 * ⚠ NO NEW LOGIC. Both buttons call the exact same context actions the icon-only
 * toggles on the cards already use (`toggleFavorite`, `toggleCompare`), keyed by
 * the same slug/type. This is the labelled presentation the design asks for, not
 * a second implementation of favourites or compare.
 *
 * The compare action can be REFUSED (wrong type, or the max reached); the
 * context returns a reason, and we surface it inline for a moment exactly as
 * CompareToggleButton does, rather than failing silently.
 */

/** How long a blocked-compare explanation stays on screen. */
const REFUSAL_MS = 2500;

export function PropertyTitleActions({
  slug,
  propertyType,
}: {
  slug: string;
  propertyType: ComparePropertyType;
}) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isComparing, toggleCompare } = useCompare();
  const [refusal, setRefusal] = useState<string | null>(null);

  // Favourites/compare live in localStorage, so the server render cannot know
  // them. Rendering the neutral state until mounted keeps hydration honest.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!refusal) return;
    const t = window.setTimeout(() => setRefusal(null), REFUSAL_MS);
    return () => window.clearTimeout(t);
  }, [refusal]);

  const faved = mounted && isFavorite(slug);
  const compared = mounted && isComparing(slug);

  const onCompare = () => {
    const result = toggleCompare(slug, propertyType);
    if (!result.ok && result.message) setRefusal(result.message);
  };

  const base =
    "flex h-[42px] items-center gap-2.5 rounded-[11px] px-4 text-sm font-semibold shadow-sm transition-colors duration-150 ease-out";

  return (
    <div className="flex flex-col items-start gap-1.5 md:items-end">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => toggleFavorite(slug)}
          aria-pressed={faved}
          className={cn(
            base,
            faved
              ? "bg-accent-tint text-accent"
              : "bg-surface-raised text-fg-secondary hover:text-fg",
          )}
        >
          <Icon
            icon={Heart}
            className={cn("size-[17px]", faved && "fill-current")}
          />
          {faved ? "В избранном" : "В избранное"}
        </button>

        <button
          type="button"
          onClick={onCompare}
          aria-pressed={compared}
          className={cn(
            base,
            compared
              ? "bg-brand-tint text-brand"
              : "bg-surface-raised text-fg-secondary hover:text-fg",
          )}
        >
          <Icon icon={ArrowLeftRight} className="size-[17px]" />
          {compared ? "В сравнении" : "Сравнить"}
        </button>
      </div>
      {refusal && (
        <p className="text-xs text-danger md:text-right">{refusal}</p>
      )}
    </div>
  );
}
