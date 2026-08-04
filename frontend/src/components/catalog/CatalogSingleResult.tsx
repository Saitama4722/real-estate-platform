"use client";

import { Icon, Icons } from "@/components/ui/icon";
import type { CatalogUiState, CatalogWidenAction } from "@/lib/catalogFilters";

interface CatalogSingleResultPanelProps {
  /** Widening suggestions derived from the applied filters. */
  actions: CatalogWidenAction[];
  /** «Расширить поиск» target: keep type+city, drop every narrowing filter. */
  widenAllState: CatalogUiState;
  onNavigate: (state: CatalogUiState) => void;
}

/**
 * Companion panel rendered NEXT TO the single result card, filling the rest of
 * the grid row on purpose (mockup state 01 — no lonely one-card row). Each
 * suggestion chip navigates to a URL that genuinely widens the current query.
 * Rendered only when there is at least one applicable widening — with no
 * filters applied there is nothing honest to offer.
 */
export function CatalogSingleResultPanel({
  actions,
  widenAllState,
  onNavigate,
}: CatalogSingleResultPanelProps) {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-col justify-center gap-4 rounded-2xl border-2 border-dashed border-border-strong bg-surface-raised/60 p-6 md:col-span-1 xl:col-span-2">
      <div>
        <h3 className="text-[17px] font-bold text-fg">
          Нашлось только одно объявление
        </h3>
        <p className="mt-1 max-w-[48ch] text-pretty text-[13.5px] text-fg-muted">
          Расширьте поиск — рядом есть похожие варианты. Один клик добавит
          условие к текущим фильтрам:
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.slice(0, 3).map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => onNavigate(a.state)}
            className="flex h-10 items-center gap-1.5 rounded-full border border-border-strong bg-surface-raised px-3.5 text-[13px] font-medium text-fg transition-colors hover:border-brand hover:text-brand focus-ring-brand"
          >
            <Icon icon={Icons.Plus} size={16} className="h-3.5 w-3.5" />
            {a.label}
          </button>
        ))}
      </div>
      <div>
        <button
          type="button"
          onClick={() => onNavigate(widenAllState)}
          className="flex h-11 items-center rounded-xl bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover focus-ring-brand"
        >
          Расширить поиск
        </button>
      </div>
    </div>
  );
}
