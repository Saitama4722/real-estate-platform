"use client";

import { Icon, Icons } from "@/components/ui/icon";
import type { CatalogChip } from "@/lib/catalogFilters";
import { cn } from "@/lib/utils";

interface CatalogStickyBarProps {
  /** Computed by the explorer's rAF-throttled scroll sweep (never IO). */
  visible: boolean;
  chips: CatalogChip[];
  total: number;
  /** Scrolls back to the panel on desktop / opens the sheet on mobile. */
  onOpenFilters: () => void;
}

/**
 * Condensed filter bar, shown once the full panel has scrolled past. Docked
 * under the sticky site header: by the time this can appear the header is in
 * its compact state, so top matches --header-h-compact.
 *
 * z-[900] on purpose (bracket form — do NOT let an editor "canonicalize" it):
 * above Leaflet map panes (~400-600) which the map view renders below it,
 * below the site header's z-[1000] so opening the mobile nav still covers it.
 */
export function CatalogStickyBar({
  visible,
  chips,
  total,
  onOpenFilters,
}: CatalogStickyBarProps) {
  const shown = chips.slice(0, 3);
  const rest = chips.length - shown.length;

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "fixed inset-x-0 top-(--header-h-compact) z-[900] border-b border-border bg-surface-raised/95 shadow-panel backdrop-blur",
        "transition-[opacity,translate] duration-[250ms] ease-out",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-2 opacity-0",
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1248px] items-center gap-3 px-4 md:px-6">
        <button
          type="button"
          onClick={onOpenFilters}
          tabIndex={visible ? 0 : -1}
          className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-surface-raised pl-3 pr-3.5 text-[13px] font-semibold text-fg transition-colors hover:border-border-strong focus-ring-brand"
        >
          <Icon icon={Icons.Filters} size={16} className="text-fg-muted" />
          Фильтры
          {chips.length > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
              {chips.length}
            </span>
          )}
        </button>
        <div className="hidden min-w-0 items-center gap-1.5 overflow-hidden md:flex">
          {shown.map((c) => (
            <span
              key={c.key}
              className="flex h-7 shrink-0 items-center rounded-full bg-brand-tint px-2.5 text-[12px] font-medium text-blue-700"
            >
              {c.label}
            </span>
          ))}
          {rest > 0 && (
            <span className="shrink-0 text-[12px] text-fg-muted">ещё {rest}</span>
          )}
        </div>
        <span className="ml-auto shrink-0 text-[13px] text-fg-muted">
          Найдено: <span className="font-bold text-fg tabular-price">{total}</span>
        </span>
      </div>
    </div>
  );
}
