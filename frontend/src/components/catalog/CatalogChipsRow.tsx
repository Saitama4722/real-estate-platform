"use client";

import { Icon, Icons } from "@/components/ui/icon";
import type { CatalogChip } from "@/lib/catalogFilters";
import { cn } from "@/lib/utils";

interface CatalogChipsRowProps {
  chips: CatalogChip[];
  onRemove: (chip: CatalogChip) => void;
  onResetAll: () => void;
  /** Desktop panel shows the explicit empty text; the mobile row hides instead. */
  showEmptyText?: boolean;
  className?: string;
}

/**
 * Applied-filter chips. Derived strictly from the URL state upstream — each
 * chip's × genuinely removes exactly its own filter, «Сбросить всё» clears
 * everything. Never a hardcoded list.
 */
export function CatalogChipsRow({
  chips,
  onRemove,
  onResetAll,
  showEmptyText = false,
  className,
}: CatalogChipsRowProps) {
  if (chips.length === 0 && !showEmptyText) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.length === 0 ? (
        <span className="py-1.5 text-[13px] text-fg-muted">
          Фильтры не применены — показаны все объявления
        </span>
      ) : (
        <>
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="flex h-9 items-center gap-0.5 rounded-full bg-brand-tint pl-3.5 pr-1.5 text-[13px] font-medium text-blue-700"
            >
              {chip.label}
              <button
                type="button"
                aria-label={`Убрать фильтр: ${chip.label}`}
                onClick={() => onRemove(chip)}
                className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-brand/10 focus-ring-brand"
              >
                <Icon icon={Icons.Close} size={16} className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onResetAll}
            className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-fg-muted transition-colors hover:text-accent focus-ring-brand"
          >
            <Icon icon={Icons.Reset} size={16} className="h-3.5 w-3.5" />
            Сбросить всё
          </button>
        </>
      )}
    </div>
  );
}
