"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, Icons } from "@/components/ui/icon";
import { CatalogPriceFields } from "@/components/catalog/CatalogPriceFields";
import { CatalogAreaFields } from "@/components/catalog/CatalogAreaFields";
import type { CatalogSelectOption } from "@/components/catalog/CatalogSelect";
import type { CatalogLocationOption } from "@/components/catalog/CatalogDistrictCombobox";
import {
  FLOOR_PRESET_OPTIONS,
  MARKET_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  ROOMS_OPTIONS,
  apartmentFiltersApply,
  propertyTypeLabel,
  type CatalogFilterState,
  type CatalogUiState,
} from "@/lib/catalogFilters";
import { cn } from "@/lib/utils";

interface CatalogFilterSheetProps {
  open: boolean;
  state: CatalogUiState;
  cityOptions: CatalogSelectOption[];
  neighborhoodOptions: CatalogLocationOption[];
  districtOptions: CatalogLocationOption[];
  commercialTypeOptions: CatalogSelectOption[];
  onPatch: (patch: Partial<CatalogFilterState>) => void;
  onResetAll: () => void;
  onClose: () => void;
  /**
   * Overrides «Показать объявления». Receives the SAME merged patch the
   * default path would have applied, so a navigating caller folds it into the
   * pushed URL instead of committing and then reading not-yet-rerendered
   * state. Same contract as the desktop panel's `onSubmit`; the sheet still
   * closes afterwards.
   */
  onSubmit?: (pending: Partial<CatalogFilterState>) => void;
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Mobile bottom sheet over the catalog. Real dialog semantics: focus is
 * trapped while open, Escape and the backdrop close it, body scroll is
 * locked, and focus returns to the opener. Discrete choices apply to the URL
 * instantly (the sheet stays open over the refreshed results); price/area
 * drafts commit on blur/Enter or via «Показать объявления», which also
 * closes. Selects are inline accordions rather than popup listboxes — every
 * option is a real focusable button, which is both the mockup's layout and
 * the simplest correct semantics in a scrollable sheet.
 */
export function CatalogFilterSheet({
  open,
  state,
  cityOptions,
  neighborhoodOptions,
  districtOptions,
  commercialTypeOptions,
  onPatch,
  onResetAll,
  onClose,
  onSubmit,
}: CatalogFilterSheetProps) {
  const f = state.filters;
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const districtQueryRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<Element | null>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [districtQuery, setDistrictQuery] = useState("");

  const [priceMin, setPriceMin] = useState(f.priceMin);
  const [priceMax, setPriceMax] = useState(f.priceMax);
  const [areaDrafts, setAreaDrafts] = useState({
    houseAreaMin: f.houseAreaMin,
    houseAreaMax: f.houseAreaMax,
    houseLandAreaMin: f.houseLandAreaMin,
    houseLandAreaMax: f.houseLandAreaMax,
    landAreaMin: f.landAreaMin,
    landAreaMax: f.landAreaMax,
    commercialAreaMin: f.commercialAreaMin,
    commercialAreaMax: f.commercialAreaMax,
  });

  /*
   * Per-key resync, same mechanism as the desktop panel — here it is
   * DEFENSIVE consistency rather than a fix for an observable bug: every
   * control in the sheet is a tap, a tap blurs the focused input, and blur
   * commits the draft to the URL, so a sheet draft is never left uncommitted
   * across a navigation (measured: the pending-navigation attempt produced
   * ?price_min=3000000 — the value round-tripped, it was not preserved).
   * Kept so both surfaces resync identically if that ever stops holding.
   */
  const prevAppliedRef = useRef<CatalogFilterState>(f);
  useEffect(() => {
    const prev = prevAppliedRef.current;
    if (prev === f) return;
    prevAppliedRef.current = f;
    if (prev.priceMin !== f.priceMin) setPriceMin(f.priceMin);
    if (prev.priceMax !== f.priceMax) setPriceMax(f.priceMax);
    setAreaDrafts((d) => {
      let next: typeof d | null = null;
      for (const key of Object.keys(d) as (keyof typeof d)[]) {
        if (prev[key] !== f[key]) {
          next = next ?? { ...d };
          next[key] = f[key];
        }
      }
      return next ?? d;
    });
  }, [f]);

  /** Pending area-draft diffs as a patch object (no navigation). */
  const pendingAreaPatch = useCallback(() => {
    const patch: Partial<CatalogFilterState> = {};
    for (const key of Object.keys(areaDrafts) as (keyof typeof areaDrafts)[]) {
      if (areaDrafts[key] !== f[key]) {
        patch[key] = areaDrafts[key];
      }
    }
    return patch;
  }, [areaDrafts, f]);

  /**
   * `extra` merges over the pending diffs — the clamped pair from
   * CatalogAreaFields arrives here before the draft state has re-rendered,
   * same idea as the desktop panel's commitDrafts(extra).
   */
  const commitAreaDrafts = useCallback(
    (extra?: Partial<CatalogFilterState>) => {
      const patch = { ...pendingAreaPatch(), ...(extra ?? {}) };
      if (Object.keys(patch).length > 0) onPatch(patch);
    },
    [pendingAreaPatch, onPatch],
  );

  // Focus trap + Escape + body scroll lock + inert background, active only
  // while open.
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    /*
     * The Tab trap below keeps KEYBOARD focus inside, but a screen reader's
     * virtual cursor is not bound by focus — without `inert` it can wander
     * into the page behind the sheet. The sheet is PORTALED to document.body
     * exactly so its siblings can be inerted without inerting the sheet
     * itself (inert also hides them from AT, so no separate aria-hidden).
     */
    const overlay = overlayRef.current;
    const inerted: HTMLElement[] = [];
    if (overlay && overlay.parentElement === document.body) {
      for (const el of Array.from(document.body.children)) {
        if (el === overlay || !(el instanceof HTMLElement)) continue;
        if (el.tagName === "SCRIPT" || el.hasAttribute("inert")) continue;
        el.setAttribute("inert", "");
        inerted.push(el);
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // First Escape inside the district search clears the query (the
        // editable-combobox convention); only an Escape with nothing left to
        // clear closes the sheet. Read .value from the DOM — this effect does
        // not re-bind on query keystrokes.
        const q = districtQueryRef.current;
        if (q && e.target === q && q.value) {
          e.preventDefault();
          setDistrictQuery("");
          return;
        }
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      inerted.forEach((el) => el.removeAttribute("inert"));
      // Focus returns to the «Фильтры» trigger that opened the sheet.
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const toggleSection = (key: string) => {
    setDistrictQuery("");
    setOpenSection((s) => (s === key ? null : key));
  };

  const accordionRow = (
    key: string,
    label: string,
    valueLabel: string,
    body: React.ReactNode,
    disabled = false,
  ) => {
    const expanded = openSection === key;
    return (
      <div className="overflow-hidden rounded-xl border border-border">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`catalog-sheet-${key}`}
          disabled={disabled}
          onClick={() => toggleSection(key)}
          className="flex h-12 w-full items-center justify-between gap-2 px-4 text-left focus-ring-brand disabled:cursor-not-allowed disabled:bg-gray-50"
        >
          <span className="text-[13.5px] text-fg-muted">{label}</span>
          <span
            className={cn(
              "flex min-w-0 items-center gap-2 text-[14px] font-semibold",
              disabled ? "text-gray-400" : "text-fg",
            )}
          >
            <span className="truncate">{valueLabel}</span>
            <Icon
              icon={Icons.ChevronDown}
              size={16}
              className={cn(
                "shrink-0 text-gray-400 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </span>
        </button>
        {expanded && (
          <div id={`catalog-sheet-${key}`} className="border-t border-gray-100 p-1.5">
            {body}
          </div>
        )}
      </div>
    );
  };

  const optionButton = (
    selected: boolean,
    label: string,
    onPick: () => void,
    key?: string,
  ) => (
    <button
      key={key ?? label}
      type="button"
      onClick={onPick}
      className={cn(
        "flex h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-[14px] transition-colors focus-ring-brand",
        selected
          ? "bg-brand-tint font-semibold text-brand"
          : "text-fg-secondary hover:bg-gray-50 hover:text-fg",
      )}
    >
      <span className="truncate">{label}</span>
      {selected && <Icon icon={Icons.Check} size={16} className="shrink-0 text-brand" />}
    </button>
  );

  const cityLabel =
    cityOptions.find((o) => o.value === f.citySlug)?.label ?? "Все города";
  const locationLabel = (() => {
    if (!f.location) return "Все районы";
    const all = [...neighborhoodOptions, ...districtOptions];
    return (
      all.find((o) => o.kind === f.location!.kind && o.slug === f.location!.slug)
        ?.name ?? "Все районы"
    );
  })();
  const commercialLabel =
    commercialTypeOptions.find((o) => o.value === f.commercialType)?.label ??
    "Любой";

  const q = districtQuery.trim().toLowerCase();
  const matchQ = (o: CatalogLocationOption) =>
    !q || o.name.toLowerCase().includes(q);
  const filteredNeighborhoods = neighborhoodOptions.filter(matchQ);
  const filteredDistricts = districtOptions.filter(matchQ);

  /* THE RULE (lib/catalogFilters): Комнат, Рынок and Этаж all read
     ApartmentDetails, so they appear only for an explicit «Квартиры». */
  const showApartmentFilters = apartmentFiltersApply(f);

  return createPortal(
    /* z-[1100] (bracket form — do not "canonicalize"): above the site header's
       z-[1000], since the sheet is a modal over the whole page. Portaled to
       document.body so the inert effect above can disable everything else
       without touching an ancestor of the sheet. */
    <div ref={overlayRef} className="fixed inset-0 z-[1100] md:hidden">
      <button
        type="button"
        aria-label="Закрыть фильтры"
        onClick={onClose}
        className="absolute inset-0 w-full animate-[ctr-fade-in_200ms_ease-out] bg-blue-950/45"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Фильтры"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[86vh] animate-[ctr-sheet-up_250ms_var(--ease-out)] flex-col rounded-t-2xl bg-surface-raised outline-none"
      >
        <div className="flex justify-center pt-2.5">
          <span aria-hidden="true" className="h-1 w-10 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <span className="text-[17px] font-bold text-fg">Фильтры</span>
          <button
            type="button"
            onClick={onResetAll}
            className="h-9 px-2 text-[13px] font-medium text-brand transition-colors hover:text-brand-hover focus-ring-brand"
          >
            Сбросить всё
          </button>
        </div>

        <div className="flex flex-col gap-3.5 overflow-y-auto px-5 py-4">
          {accordionRow(
            "type",
            "Тип недвижимости",
            propertyTypeLabel(f.propertyType),
            <div>
              {PROPERTY_TYPE_OPTIONS.map((o) =>
                optionButton(f.propertyType === o.value, o.label, () => {
                  onPatch({ propertyType: o.value });
                  setOpenSection(null);
                }),
              )}
            </div>,
          )}

          {accordionRow(
            "city",
            "Город",
            cityLabel,
            <div>
              {cityOptions.map((o) =>
                optionButton(f.citySlug === o.value, o.label, () => {
                  onPatch({ citySlug: o.value, location: null });
                  setOpenSection(null);
                }),
              )}
            </div>,
          )}

          {accordionRow(
            "district",
            "Район",
            f.citySlug ? locationLabel : "Сначала город",
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              <label className="mx-1.5 mt-1 flex h-10 items-center gap-2 rounded-lg border border-border px-3 focus-within:border-brand">
                <Icon icon={Icons.Search} size={16} className="shrink-0 text-gray-400" />
                <input
                  ref={districtQueryRef}
                  type="text"
                  value={districtQuery}
                  onChange={(e) => setDistrictQuery(e.target.value)}
                  placeholder="Найти район"
                  aria-label="Поиск района"
                  className="w-full bg-transparent text-[14px] text-fg outline-none placeholder:text-gray-400"
                />
              </label>
              {optionButton(f.location === null, "Все районы", () => {
                onPatch({ location: null });
                setOpenSection(null);
              })}
              {filteredNeighborhoods.length > 0 && (
                <div className="select-none px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400">
                  Микрорайоны
                </div>
              )}
              {filteredNeighborhoods.map((o) =>
                optionButton(
                  f.location?.kind === o.kind && f.location?.slug === o.slug,
                  o.name,
                  () => {
                    onPatch({ location: { kind: o.kind, slug: o.slug } });
                    setOpenSection(null);
                  },
                  `${o.kind}:${o.slug}`,
                ),
              )}
              {filteredDistricts.length > 0 && (
                <div className="select-none px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400">
                  Районы и населённые пункты
                </div>
              )}
              {filteredDistricts.map((o) =>
                optionButton(
                  f.location?.kind === o.kind && f.location?.slug === o.slug,
                  o.name,
                  () => {
                    onPatch({ location: { kind: o.kind, slug: o.slug } });
                    setOpenSection(null);
                  },
                  `${o.kind}:${o.slug}`,
                ),
              )}
              {q && filteredNeighborhoods.length === 0 && filteredDistricts.length === 0 && (
                <div className="px-3 py-2 text-[14px] text-gray-400">
                  Ничего не найдено
                </div>
              )}
            </div>,
            !f.citySlug,
          )}

          <CatalogPriceFields
            minValue={priceMin}
            maxValue={priceMax}
            onMinChange={setPriceMin}
            onMaxChange={setPriceMax}
            onCommit={(min, max) => {
              if (min !== f.priceMin || max !== f.priceMax) {
                onPatch({ priceMin: min, priceMax: max });
              } else {
                setPriceMin(min);
                setPriceMax(max);
              }
            }}
          />

          {showApartmentFilters && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-fg-muted">
                  Комнат
                </span>
                <div role="group" aria-label="Комнат" className="flex flex-wrap gap-1.5">
                  {ROOMS_OPTIONS.map((o) => {
                    const active = f.rooms === o.value;
                    return (
                      <button
                        key={o.value || "__any"}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onPatch({ rooms: o.value })}
                        className={cn(
                          "flex h-11 items-center justify-center rounded-xl text-[13.5px] transition-colors focus-ring-brand",
                          o.value === "" || o.value === "0" || o.value === "4plus"
                            ? "px-4"
                            : "w-11",
                          active
                            ? "bg-brand font-semibold text-white"
                            : "border border-border bg-surface-raised font-medium text-fg hover:border-border-strong",
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-fg-muted">
                  Рынок
                </span>
                {/* 2×2 grid: MARKET_OPTIONS now carries four values («Иное»
                    included — it is reachable from the hero search, so the
                    sheet must be able to express it; review finding 5). */}
                <div
                  role="group"
                  aria-label="Рынок"
                  className="grid grid-cols-2 gap-1 rounded-xl bg-surface-inset p-1"
                >
                  {MARKET_OPTIONS.map((m) => {
                    const active = f.marketType === m.value;
                    return (
                      <button
                        key={m.value || "__any"}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onPatch({ marketType: m.value })}
                        className={cn(
                          "h-10 rounded-lg text-[13px] transition-colors focus-ring-brand",
                          active
                            ? "bg-surface-raised font-semibold text-fg shadow-xs"
                            : "text-fg-secondary hover:text-fg",
                        )}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Этаж — same apartments-only rule as Комнат and Рынок above. */}
          {showApartmentFilters &&
            accordionRow(
              "floor",
              "Этаж",
              FLOOR_PRESET_OPTIONS.find((o) => o.value === f.floorPreset)?.label ??
                "Любой",
              <div>
                {FLOOR_PRESET_OPTIONS.map((o) =>
                  optionButton(f.floorPreset === o.value, o.label, () => {
                    onPatch({ floorPreset: o.value });
                    setOpenSection(null);
                  }),
                )}
              </div>,
            )}

          {f.propertyType === "house" && (
            <>
              <CatalogAreaFields
                label="Площадь дома"
                unit="м²"
                minValue={areaDrafts.houseAreaMin}
                maxValue={areaDrafts.houseAreaMax}
                onMinChange={(v) => setAreaDrafts((d) => ({ ...d, houseAreaMin: v }))}
                onMaxChange={(v) => setAreaDrafts((d) => ({ ...d, houseAreaMax: v }))}
                onCommit={(min, max) =>
                  commitAreaDrafts({ houseAreaMin: min, houseAreaMax: max })
                }
              />
              <CatalogAreaFields
                label="Участок"
                unit="сот."
                minValue={areaDrafts.houseLandAreaMin}
                maxValue={areaDrafts.houseLandAreaMax}
                onMinChange={(v) => setAreaDrafts((d) => ({ ...d, houseLandAreaMin: v }))}
                onMaxChange={(v) => setAreaDrafts((d) => ({ ...d, houseLandAreaMax: v }))}
                onCommit={(min, max) =>
                  commitAreaDrafts({ houseLandAreaMin: min, houseLandAreaMax: max })
                }
              />
            </>
          )}

          {f.propertyType === "land" && (
            <CatalogAreaFields
              label="Площадь участка"
              unit="сот."
              minValue={areaDrafts.landAreaMin}
              maxValue={areaDrafts.landAreaMax}
              onMinChange={(v) => setAreaDrafts((d) => ({ ...d, landAreaMin: v }))}
              onMaxChange={(v) => setAreaDrafts((d) => ({ ...d, landAreaMax: v }))}
              onCommit={(min, max) =>
                commitAreaDrafts({ landAreaMin: min, landAreaMax: max })
              }
            />
          )}

          {f.propertyType === "commercial" && (
            <>
              {accordionRow(
                "commercial_type",
                "Тип помещения",
                commercialLabel,
                <div>
                  {commercialTypeOptions.map((o) =>
                    optionButton(f.commercialType === o.value, o.label, () => {
                      onPatch({ commercialType: o.value });
                      setOpenSection(null);
                    }),
                  )}
                </div>,
              )}
              <CatalogAreaFields
                label="Площадь"
                unit="м²"
                minValue={areaDrafts.commercialAreaMin}
                maxValue={areaDrafts.commercialAreaMax}
                onMinChange={(v) => setAreaDrafts((d) => ({ ...d, commercialAreaMin: v }))}
                onMaxChange={(v) => setAreaDrafts((d) => ({ ...d, commercialAreaMax: v }))}
                onCommit={(min, max) =>
                  commitAreaDrafts({ commercialAreaMin: min, commercialAreaMax: max })
                }
              />
            </>
          )}
        </div>

        <div className="border-t border-gray-100 p-4">
          <button
            type="button"
            onClick={() => {
              /*
               * ONE merged patch — never two onPatch calls in the same tick.
               * Two calls both derive from the same pre-navigation state, so
               * the second's URL is missing the first's change and silently
               * overwrites it (review finding 1: area + price edits submitted
               * together deterministically lost the area). Mirrors the
               * desktop panel's commitDrafts(extra).
               */
              const patch: Partial<CatalogFilterState> = pendingAreaPatch();
              if (priceMin !== f.priceMin) patch.priceMin = priceMin;
              if (priceMax !== f.priceMax) patch.priceMax = priceMax;
              if (onSubmit) {
                onSubmit(patch);
              } else if (Object.keys(patch).length > 0) {
                onPatch(patch);
              }
              onClose();
            }}
            className="h-12 w-full rounded-xl bg-brand text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover focus-ring-brand"
          >
            Показать объявления
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
