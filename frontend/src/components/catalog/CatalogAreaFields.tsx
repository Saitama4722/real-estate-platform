"use client";

import { normalizeDecimalInput } from "@/lib/priceDigits";
import { cn } from "@/lib/utils";

interface CatalogAreaFieldsProps {
  /** Field caption, e.g. «Дом, м²» / «Участок, сот.» / «Площадь, м²». */
  label: string;
  /** Unit suffix rendered inside each input lane. */
  unit: string;
  minValue: string;
  maxValue: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  /**
   * Blur/Enter — the point where the panel pushes the URL. Receives the pair
   * AFTER the от≤до clamp (same contract as CatalogPriceFields.onCommit): the
   * parent must commit THESE values, not its own draft state, which has not
   * re-rendered with the clamp yet.
   */
  onCommit: (min: string, max: string) => void;
  className?: string;
}

/**
 * Decimal-friendly sanitizer: digits plus at most one comma/dot separator.
 * Keeps whatever the user typed otherwise («45,5»); URL serialization
 * normalizes to a canonical decimal via normalizeDecimalInput.
 */
function sanitizeArea(v: string): string {
  const cleaned = v.replace(/[^\d.,]/g, "");
  const firstSep = cleaned.search(/[.,]/);
  if (firstSep === -1) return cleaned;
  return (
    cleaned.slice(0, firstSep + 1) +
    cleaned.slice(firstSep + 1).replace(/[.,]/g, "")
  );
}

/**
 * Min/max area pair on the price-block geometry (one 52px bordered field, two
 * lanes with a centre divider). Secondary («Ещё фильтры») filter — real and
 * API-backed, deliberately NOT a «Скоро» placeholder.
 */
export function CatalogAreaFields({
  label,
  unit,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  onCommit,
  className,
}: CatalogAreaFieldsProps) {
  /** «От» may not exceed «до»: the edited bound is clamped to the other on
   *  commit, mirroring CatalogPriceFields. Values compare through
   *  normalizeDecimalInput so «45,5» and «45.5» compare numerically. */
  const commit = (edited: "min" | "max") => {
    let min = minValue;
    let max = maxValue;
    const a = normalizeDecimalInput(min);
    const b = normalizeDecimalInput(max);
    if (a !== undefined && b !== undefined && Number(a) > Number(b)) {
      if (edited === "min") {
        min = max;
        onMinChange(min);
      } else {
        max = min;
        onMaxChange(max);
      }
    }
    onCommit(min, max);
  };

  const lane = (
    caption: string,
    value: string,
    apply: (v: string) => void,
    edited: "min" | "max",
    placeholder: string,
  ) => (
    <label className="flex min-w-0 flex-1 cursor-text flex-col justify-center gap-0.5 px-3.5">
      <span className="text-[11px] font-medium uppercase leading-none tracking-[0.04em] text-fg-muted">
        {caption}
      </span>
      <span className="flex items-baseline gap-1">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          /* The visible lane caption is just «от»/«до» — identical across
             every area pair on the page, so the group label is folded into
             the accessible name (review finding 11). */
          aria-label={`${label}, ${caption}`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => apply(sanitizeArea(e.target.value).slice(0, 8))}
          onBlur={() => commit(edited)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(edited);
            }
          }}
          className="w-full min-w-0 bg-transparent text-[14px] font-semibold text-fg outline-none placeholder:font-normal placeholder:text-gray-300"
        />
        <span aria-hidden="true" className="whitespace-nowrap text-[13px] text-gray-400">
          {unit}
        </span>
      </span>
    </label>
  );

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-fg-muted">
        {label}
      </span>
      <div className="flex h-[52px] w-full min-w-[220px] divide-x divide-border rounded-xl border border-border bg-surface-raised transition-colors hover:border-border-strong focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
        {lane("от", minValue, onMinChange, "min", "0")}
        {lane("до", maxValue, onMaxChange, "max", "Не важно")}
      </div>
    </div>
  );
}
