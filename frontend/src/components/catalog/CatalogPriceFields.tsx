"use client";

import { useRef } from "react";
import { PRICE_MAX_DIGITS, digitsOnly, groupDigits } from "@/lib/priceDigits";
import { cn } from "@/lib/utils";

interface CatalogPriceFieldsProps {
  /** Raw digit strings (no spaces) — the shared PriceInput convention. */
  minValue: string;
  maxValue: string;
  onMinChange: (raw: string) => void;
  onMaxChange: (raw: string) => void;
  /**
   * Called when an edit is finalized (blur or Enter) — this is where the
   * panel pushes the URL. Receives the pair AFTER the от≤до clamp.
   */
  onCommit: (min: string, max: string) => void;
  className?: string;
}

/**
 * The mockup's price range block: two labelled inputs sharing one 52px field
 * with a centre divider and a ₽ suffix each. Digits only, live space grouping
 * as the user types (caret preserved by digit count), numeric mobile
 * keyboard. «От» may not exceed «до»: on commit the edited bound is clamped
 * to the other. Typing edits a local draft; the URL is pushed on blur/Enter
 * via onCommit — never per keystroke.
 */
export function CatalogPriceFields({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  onCommit,
  className,
}: CatalogPriceFieldsProps) {
  const minRef = useRef<HTMLInputElement>(null);
  const maxRef = useRef<HTMLInputElement>(null);

  const handleInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    apply: (raw: string) => void,
    ref: React.RefObject<HTMLInputElement | null>,
  ) => {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    // Digits before the caret survive any grouping change — count them, then
    // restore the caret after that many digits in the reformatted value.
    const digitsBeforeCaret = digitsOnly(el.value.slice(0, caret)).length;
    const raw = digitsOnly(el.value).slice(0, PRICE_MAX_DIGITS);
    apply(raw);
    requestAnimationFrame(() => {
      const input = ref.current;
      if (!input) return;
      const formatted = groupDigits(raw);
      let pos = 0;
      let seen = 0;
      while (pos < formatted.length && seen < digitsBeforeCaret) {
        if (/\d/.test(formatted[pos])) seen += 1;
        pos += 1;
      }
      input.setSelectionRange(pos, pos);
    });
  };

  /** Clamp the edited bound so «от» can never exceed «до», then commit. */
  const commit = (edited: "min" | "max") => {
    let min = minValue;
    let max = maxValue;
    if (min && max && Number(min) > Number(max)) {
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

  const field = (
    label: string,
    value: string,
    ref: React.RefObject<HTMLInputElement | null>,
    apply: (raw: string) => void,
    edited: "min" | "max",
    placeholder: string,
  ) => (
    <label className="flex min-w-0 flex-1 cursor-text flex-col justify-center gap-0.5 px-3.5">
      <span className="text-[11px] font-medium uppercase leading-none tracking-[0.04em] text-fg-muted">
        {label}
      </span>
      <span className="flex items-baseline gap-1">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={groupDigits(value)}
          placeholder={placeholder}
          onChange={(e) => handleInput(e, apply, ref)}
          onBlur={() => commit(edited)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(edited);
            }
          }}
          className="w-full min-w-0 bg-transparent text-[14px] font-semibold text-fg outline-none placeholder:font-normal placeholder:text-gray-300"
        />
        <span aria-hidden="true" className="text-[13px] text-gray-400">
          ₽
        </span>
      </span>
    </label>
  );

  return (
    <div
      className={cn(
        "flex h-[52px] divide-x divide-border rounded-xl border border-border bg-surface-raised transition-colors",
        "hover:border-border-strong focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15",
        className,
      )}
    >
      {field("Цена от", minValue, minRef, onMinChange, "min", "0")}
      {field("Цена до", maxValue, maxRef, onMaxChange, "max", "Не важно")}
    </div>
  );
}
