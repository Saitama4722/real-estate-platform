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
import type {
  CatalogLocationKind,
  CatalogLocationSelection,
} from "@/lib/catalogFilters";
import { cn } from "@/lib/utils";

export interface CatalogLocationOption {
  kind: CatalogLocationKind;
  slug: string;
  name: string;
}

interface CatalogDistrictComboboxProps {
  /** Микрорайоны — rendered first, under their group header. */
  neighborhoodOptions: CatalogLocationOption[];
  /** Districts / suburbs — rendered after. */
  districtOptions: CatalogLocationOption[];
  value: CatalogLocationSelection | null;
  onChange: (selection: CatalogLocationSelection | null) => void;
  /** Mockup state: the district field is disabled until a city is chosen. */
  disabled?: boolean;
  className?: string;
}

interface FlatItem {
  /** null = «Все районы». */
  selection: CatalogLocationSelection | null;
  label: string;
  /** Group header rendered above this item (not itself navigable). */
  groupBefore?: string;
}

function keyOf(sel: CatalogLocationSelection | null): string {
  return sel ? `${sel.kind}:${sel.slug}` : "__all";
}

/**
 * Editable (searchable) combobox for the Район filter — the two-table
 * Микрорайоны / Районы pattern from SearchBar's DistrictCombobox, rebuilt on
 * the catalog field geometry with the full keyboard contract: typing filters
 * (case-insensitive substring), arrows move the active option, Enter selects,
 * Escape closes and reverts the text, Tab/outside-click close. DOM focus stays
 * in the input (it IS the trigger), aria-activedescendant carries the active
 * option to AT. Home/End are deliberately left to the text caret, as the APG
 * editable-combobox pattern specifies.
 */
export function CatalogDistrictCombobox({
  neighborhoodOptions,
  districtOptions,
  value,
  onChange,
  disabled = false,
  className,
}: CatalogDistrictComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const selectedLabel = useMemo(() => {
    if (!value) return "Все районы";
    const all = [...neighborhoodOptions, ...districtOptions];
    const found = all.find((o) => o.kind === value.kind && o.slug === value.slug);
    return found?.name ?? "Все районы";
  }, [neighborhoodOptions, districtOptions, value]);

  /** Filtered, flattened, navigable list («Все районы» + both groups). */
  const items = useMemo<FlatItem[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (o: CatalogLocationOption) =>
      !q || o.name.toLowerCase().includes(q);
    const out: FlatItem[] = [{ selection: null, label: "Все районы" }];
    const nbs = neighborhoodOptions.filter(match);
    const ds = districtOptions.filter(match);
    nbs.forEach((o, i) =>
      out.push({
        selection: { kind: o.kind, slug: o.slug },
        label: o.name,
        groupBefore: i === 0 ? "Микрорайоны" : undefined,
      }),
    );
    ds.forEach((o, i) =>
      out.push({
        selection: { kind: o.kind, slug: o.slug },
        label: o.name,
        groupBefore: i === 0 ? "Районы и населённые пункты" : undefined,
      }),
    );
    return out;
  }, [neighborhoodOptions, districtOptions, query]);

  const openList = useCallback(() => {
    setQuery("");
    setActiveIndex(-1);
    setOpen(true);
  }, []);

  const closeList = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }, []);

  const commit = useCallback(
    (item: FlatItem) => {
      onChange(item.selection);
      closeList();
    },
    [onChange, closeList],
  );

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

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({
      block: "nearest",
    });
    // optionId is stable for a given render; activeIndex is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(items.length - 1, i + 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        return;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && items[activeIndex]) {
          commit(items[activeIndex]);
        } else if (items.length === 2 && query.trim()) {
          // Exactly one real match (index 0 is always «Все районы») — Enter
          // takes it without requiring an arrow-down first.
          commit(items[1]);
        }
        return;
      case "Escape":
        e.preventDefault();
        closeList();
        return;
      case "Tab":
        closeList();
        return;
    }
  };

  // Rendered rows interleave non-navigable group headers with options, but
  // aria indices/ids follow the flat `items` list only.
  let renderedIndex = -1;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex h-[52px] flex-col justify-center gap-0.5 rounded-xl border bg-surface-raised px-3.5 transition-colors",
          disabled
            ? "cursor-not-allowed bg-gray-50"
            : "cursor-text focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15",
          open
            ? "border-brand ring-2 ring-brand/15"
            : "border-border hover:border-border-strong",
          disabled && "hover:border-border",
        )}
        onMouseDown={(e) => {
          // Clicking anywhere on the field focuses the input (label included).
          if (disabled) return;
          if (e.target !== inputRef.current) {
            e.preventDefault();
            inputRef.current?.focus();
            if (!open) openList();
          }
        }}
      >
        <label
          htmlFor={`${baseId}-input`}
          className={cn(
            "text-[11px] font-medium uppercase leading-none tracking-[0.04em]",
            disabled ? "text-gray-400" : "text-fg-muted",
          )}
        >
          Район
        </label>
        <span className="flex w-full items-center justify-between gap-1.5">
          <input
            ref={inputRef}
            id={`${baseId}-input`}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && activeIndex >= 0 ? optionId(activeIndex) : undefined
            }
            disabled={disabled}
            value={disabled ? "Сначала город" : open ? query : selectedLabel}
            placeholder={open ? selectedLabel : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(-1);
              if (!open) setOpen(true);
            }}
            onFocus={() => {
              if (!open) openList();
            }}
            onKeyDown={onKeyDown}
            className={cn(
              "w-full min-w-0 truncate bg-transparent text-[14px] outline-none",
              disabled
                ? "cursor-not-allowed font-medium text-gray-400"
                : "font-semibold text-fg placeholder:font-normal placeholder:text-gray-400",
            )}
          />
          <Icon
            icon={Icons.ChevronDown}
            size={16}
            className={cn(
              "shrink-0 transition-transform",
              disabled ? "text-gray-300" : "text-gray-400",
              open && "rotate-180",
            )}
          />
        </span>
      </div>

      {open && !disabled && (
        /* z-[1000] MUST stay in this arbitrary-value bracket form (do NOT let an
           editor "canonicalize" it to bare z-1000) — required for anything that
           may overlay Leaflet panes. See the z-index rules in CLAUDE.md. */
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Район"
          ref={listRef}
          className="absolute left-0 top-[calc(100%+6px)] z-[1000] max-h-[320px] w-full min-w-[210px] overflow-auto rounded-xl bg-surface-raised p-1.5 shadow-lg ring-1 ring-gray-900/10"
        >
          {items.map((item) => {
            renderedIndex += 1;
            const i = renderedIndex;
            const selected = keyOf(value) === keyOf(item.selection);
            const active = i === activeIndex;
            return (
              <li key={keyOf(item.selection)} className="contents">
                {item.groupBefore && (
                  <div
                    role="presentation"
                    className="select-none px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-muted"
                  >
                    {item.groupBefore}
                  </div>
                )}
                <div
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(item);
                  }}
                  onMouseMove={() => {
                    if (activeIndex !== i) setActiveIndex(i);
                  }}
                  className={cn(
                    "flex h-10 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 text-[14px] transition-colors",
                    selected
                      ? "bg-brand-tint font-semibold text-brand"
                      : "text-fg-secondary",
                    active && !selected && "bg-gray-50 text-fg",
                    active && "outline-2 -outline-offset-2 outline-brand",
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {selected && (
                    <Icon
                      icon={Icons.Check}
                      size={16}
                      className="shrink-0 text-brand"
                    />
                  )}
                </div>
              </li>
            );
          })}
          {items.length === 1 && query.trim() && (
            <div className="px-3 py-2 text-[14px] text-fg-muted">
              Ничего не найдено
            </div>
          )}
        </ul>
      )}
    </div>
  );
}
