"use client";

import { Icon, Icons } from "@/components/ui/icon";
import type { CatalogUiState, CatalogWidenAction } from "@/lib/catalogFilters";

interface CatalogEmptyStateProps {
  /** Genuinely-widening actions derived from the applied filters (may be empty). */
  actions: CatalogWidenAction[];
  resetState: CatalogUiState;
  onNavigate: (state: CatalogUiState) => void;
}

/** Friendlier button labels for the mockup's zero-state (generic wording). */
const EMPTY_STATE_LABELS: Record<string, string> = {
  drop_location: "Расширить район",
  raise_price: "Увеличить бюджет",
  drop_city: "Все города",
  drop_rooms: "Любое число комнат",
  drop_search: "Убрать запрос",
};

/**
 * «Ничего не найдено» — message plus concrete actions instead of a dead end.
 * Every button navigates to a genuinely widened /catalog URL.
 */
export function CatalogEmptyState({
  actions,
  resetState,
  onNavigate,
}: CatalogEmptyStateProps) {
  const secondary = actions.slice(0, 2);
  return (
    <div className="mt-5 flex flex-col items-center gap-2 rounded-2xl bg-surface-raised px-6 py-14 text-center shadow-sm">
      <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-brand-tint text-brand">
        <Icon icon={Icons.Search} size={24} />
      </span>
      <h3 className="text-[18px] font-bold text-fg">
        По вашему запросу ничего не найдено
      </h3>
      <p className="max-w-[46ch] text-small text-fg-muted">
        Попробуйте смягчить условия — обычно помогает один из этих шагов:
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2.5">
        <button
          type="button"
          onClick={() => onNavigate(resetState)}
          className="flex h-11 items-center rounded-xl bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover focus-ring-brand"
        >
          Сбросить фильтры
        </button>
        {secondary.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => onNavigate(a.state)}
            className="flex h-11 items-center rounded-xl border border-border-strong bg-surface-raised px-5 text-[14px] font-semibold text-fg transition-colors hover:border-gray-400 focus-ring-brand"
          >
            {EMPTY_STATE_LABELS[a.key] ?? a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
