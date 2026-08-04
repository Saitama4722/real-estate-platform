"use client";

import { Icon, Icons } from "@/components/ui/icon";
import { CatalogSelect } from "@/components/catalog/CatalogSelect";
import {
  SORT_OPTIONS,
  type CatalogSortValue,
  type CatalogViewValue,
} from "@/lib/catalogFilters";
import { cn } from "@/lib/utils";

interface CatalogResultsHeaderProps {
  total: number;
  /** Applied-filter count — the mobile «Фильтры» button badge. */
  filtersCount: number;
  sort: CatalogSortValue;
  view: CatalogViewValue;
  onSortChange: (sort: CatalogSortValue) => void;
  onViewChange: (view: CatalogViewValue) => void;
  onOpenSheet: () => void;
}

/**
 * «Найдено: N» + the single list/map entry point + the sort control. Sort and
 * view both live in the URL; the mobile «Фильтры» button opens the bottom
 * sheet and carries the applied-filter count.
 */
export function CatalogResultsHeader({
  total,
  filtersCount,
  sort,
  view,
  onSortChange,
  onViewChange,
  onOpenSheet,
}: CatalogResultsHeaderProps) {
  const viewButton = (
    target: CatalogViewValue,
    icon: typeof Icons.List,
    label: string,
  ) => {
    const active = view === target;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => onViewChange(target)}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium transition-colors focus-ring-brand",
          active
            ? "bg-brand text-white shadow-xs"
            : "text-fg-secondary hover:text-fg",
        )}
      >
        <Icon icon={icon} size={16} />
        <span className="hidden sm:inline">{label}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <h2 className="mr-1 text-[17px] font-bold tracking-tight text-fg">
        Найдено: <span className="tabular-price">{total}</span>
      </h2>

      <button
        type="button"
        onClick={onOpenSheet}
        className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface-raised pl-3.5 pr-3 text-[13.5px] font-semibold text-fg transition-colors hover:border-border-strong focus-ring-brand md:hidden"
      >
        <Icon icon={Icons.Filters} size={16} className="text-fg-muted" />
        Фильтры
        {filtersCount > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
            {filtersCount}
          </span>
        )}
      </button>

      <div className="ml-auto flex flex-wrap items-center gap-2.5">
        <CatalogSelect
          label="Сортировка"
          variant="compact"
          icon={Icons.Sort}
          align="right"
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={sort}
          onChange={(v) => onSortChange(v as CatalogSortValue)}
        />
        <div
          role="group"
          aria-label="Вид результатов"
          className="flex h-11 items-center gap-1 rounded-xl border border-border bg-surface-raised p-1"
        >
          {viewButton("list", Icons.List, "Списком")}
          {viewButton("map", Icons.Map, "На карте")}
        </div>
      </div>
    </div>
  );
}
