"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon, Icons } from "@/components/ui/icon";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CatalogSelectOption {
  value: string;
  label: string;
}

interface CatalogSelectProps {
  /** Small uppercase caption inside the field trigger («ТИП НЕДВИЖИМОСТИ»). */
  label: string;
  options: CatalogSelectOption[];
  value: string;
  onChange: (value: string) => void;
  /**
   * "field" — the 52px stacked label+value trigger of the filter panel.
   * "compact" — the 44px icon+value trigger of the results-header sort control.
   */
  variant?: "field" | "compact";
  /** Leading glyph for the compact variant (e.g. Icons.Sort). */
  icon?: LucideIcon;
  disabled?: boolean;
  /** Shown as the value while disabled (e.g. «Сначала город»). */
  disabledPlaceholder?: string;
  /** Popup alignment; the sort control right-aligns like the mockup. */
  align?: "left" | "right";
  className?: string;
}

/**
 * Select-only combobox per the WAI-ARIA APG pattern. Real DOM focus stays on
 * the trigger button the whole time (so "focus returns to the trigger on
 * close" holds by construction); the active option is conveyed with
 * aria-activedescendant. Full keyboard support: Enter/Space/arrows open,
 * arrows + Home/End move, printable-character typeahead (works closed too),
 * Enter/Space select, Escape/Tab close without committing the active option.
 */
export function CatalogSelect({
  label,
  options,
  value,
  onChange,
  variant = "field",
  icon,
  disabled = false,
  disabledPlaceholder,
  align = "left",
  className,
}: CatalogSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeaheadRef = useRef<{ buffer: string; at: number }>({
    buffer: "",
    at: 0,
  });
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const labelId = `${baseId}-label`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const selectedIndex = useMemo(
    () => options.findIndex((o) => o.value === value),
    [options, value],
  );
  const selectedLabel =
    selectedIndex >= 0 ? options[selectedIndex].label : (options[0]?.label ?? "");

  const openList = useCallback(
    (initialIndex?: number) => {
      setActiveIndex(
        initialIndex !== undefined
          ? initialIndex
          : selectedIndex >= 0
            ? selectedIndex
            : 0,
      );
      setOpen(true);
    },
    [selectedIndex],
  );

  const closeList = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const commit = useCallback(
    (index: number) => {
      const opt = options[index];
      if (opt) onChange(opt.value);
      closeList();
    },
    [options, onChange, closeList],
  );

  // Outside interaction closes without committing.
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeList();
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open, closeList]);

  // Keep the active option scrolled into view while navigating.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.children.item(activeIndex) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const findByTypeahead = useCallback(
    (char: string): number => {
      const now = Date.now();
      const t = typeaheadRef.current;
      t.buffer = now - t.at > 500 ? char : t.buffer + char;
      t.at = now;
      const q = t.buffer.toLowerCase();
      const from = activeIndex >= 0 ? activeIndex : 0;
      // Search after the active option first, then wrap.
      const find = (needle: string): number => {
        for (let step = 1; step <= options.length; step++) {
          const i = (from + step) % options.length;
          if (options[i].label.toLowerCase().startsWith(needle)) return i;
        }
        return -1;
      };
      const hit = find(q);
      if (hit >= 0) return hit;
      // APG behaviour: a buffer of one REPEATED character cycles through the
      // options starting with it («к», «кк» → Квартиры, Коммерция, …) instead
      // of demanding an ever-longer literal prefix (review finding 11).
      if (q.length > 1 && q.split("").every((c) => c === q[0])) {
        return find(q[0]);
      }
      return -1;
    },
    [options, activeIndex],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const { key } = e;

    if (!open) {
      if (key === "Enter" || key === " " || key === "ArrowDown") {
        e.preventDefault();
        openList();
        return;
      }
      if (key === "ArrowUp") {
        e.preventDefault();
        openList(selectedIndex >= 0 ? selectedIndex : options.length - 1);
        return;
      }
      if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && key !== " ") {
        const i = findByTypeahead(key);
        if (i >= 0) openList(i);
        return;
      }
      return;
    }

    switch (key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        return;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        return;
      case "End":
        e.preventDefault();
        setActiveIndex(options.length - 1);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (activeIndex >= 0) commit(activeIndex);
        else closeList();
        return;
      case "Escape":
        e.preventDefault();
        closeList();
        return;
      case "Tab":
        // Let focus move on naturally; just close the popup.
        closeList();
        return;
      default:
        if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const i = findByTypeahead(key);
          if (i >= 0) setActiveIndex(i);
        }
    }
  };

  const isField = variant === "field";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-labelledby={`${labelId} ${baseId}-value`}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          "w-full bg-surface-raised text-left transition-colors focus-ring-brand",
          "disabled:cursor-not-allowed disabled:bg-gray-50",
          isField
            ? "flex h-[52px] flex-col justify-center gap-0.5 rounded-xl border px-3.5"
            : "flex h-11 items-center gap-2 rounded-xl border pl-3.5 pr-3 text-[13.5px]",
          open
            ? "border-brand ring-2 ring-brand/15"
            : "border-border hover:border-border-strong",
        )}
      >
        {isField ? (
          <>
            <span
              id={labelId}
              className={cn(
                "text-[11px] font-medium uppercase leading-none tracking-[0.04em]",
                disabled ? "text-gray-400" : "text-fg-muted",
              )}
            >
              {label}
            </span>
            <span className="flex w-full items-center justify-between gap-1.5">
              <span
                id={`${baseId}-value`}
                className={cn(
                  "truncate text-[14px]",
                  disabled ? "font-medium text-gray-400" : "font-semibold text-fg",
                )}
              >
                {disabled && disabledPlaceholder ? disabledPlaceholder : selectedLabel}
              </span>
              <Icon
                icon={Icons.ChevronDown}
                size={16}
                className={cn(
                  "shrink-0 text-gray-400 transition-transform",
                  open && "rotate-180",
                )}
              />
            </span>
          </>
        ) : (
          <>
            <span id={labelId} className="sr-only">
              {label}
            </span>
            {icon && (
              <Icon icon={icon} size={16} className="shrink-0 text-fg-muted" />
            )}
            <span id={`${baseId}-value`} className="font-semibold text-fg">
              {selectedLabel}
            </span>
            <Icon
              icon={Icons.ChevronDown}
              size={16}
              className={cn(
                "shrink-0 text-gray-400 transition-transform",
                open && "rotate-180",
              )}
            />
          </>
        )}
      </button>

      {open && (
        /* z-[1000] MUST stay in this arbitrary-value bracket form (do NOT let an
           editor "canonicalize" it to bare z-1000) — the drift-proof spelling
           required for anything that may overlay Leaflet panes (z ~400-600).
           See the z-index rules in CLAUDE.md. */
        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={labelId}
          ref={listRef}
          className={cn(
            "absolute top-[calc(100%+6px)] z-[1000] max-h-[320px] overflow-auto rounded-xl bg-surface-raised p-1.5 shadow-lg ring-1 ring-gray-900/10",
            isField ? "left-0 w-full min-w-[210px]" : "w-56",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {options.map((opt, i) => {
            const selected = i === selectedIndex;
            const active = i === activeIndex;
            return (
              <li
                key={opt.value || "__empty"}
                id={optionId(i)}
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => {
                  // Fires before the outside-click closer and does not move
                  // focus off the trigger (the established combobox idiom).
                  e.preventDefault();
                  commit(i);
                }}
                onMouseMove={() => {
                  if (activeIndex !== i) setActiveIndex(i);
                }}
                className={cn(
                  "flex h-10 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 text-left text-[14px] transition-colors",
                  selected
                    ? "bg-brand-tint font-semibold text-brand"
                    : "text-fg-secondary",
                  active && !selected && "bg-gray-50 text-fg",
                  // Keyboard-active marker, matching the mockup's inset outline.
                  active && "outline-2 -outline-offset-2 outline-brand",
                )}
              >
                <span className="truncate">{opt.label}</span>
                {selected && (
                  <Icon
                    icon={Icons.Check}
                    size={16}
                    className="shrink-0 text-brand"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
