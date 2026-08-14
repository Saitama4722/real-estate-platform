"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, Icons } from "@/components/ui/icon";
import { CatalogSelect, type CatalogSelectOption } from "@/components/catalog/CatalogSelect";
import {
  CatalogDistrictCombobox,
  type CatalogLocationOption,
} from "@/components/catalog/CatalogDistrictCombobox";
import { CatalogPriceFields } from "@/components/catalog/CatalogPriceFields";
import { CatalogAreaFields } from "@/components/catalog/CatalogAreaFields";
import { CatalogChipsRow } from "@/components/catalog/CatalogChipsRow";
import {
  FLOOR_PRESET_OPTIONS,
  MARKET_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  ROOMS_OPTIONS,
  apartmentFiltersApply,
  countSecondaryFilters,
  type CatalogChip,
  type CatalogFilterState,
  type CatalogFloorPreset,
  type CatalogUiState,
} from "@/lib/catalogFilters";
import { cn } from "@/lib/utils";

interface CatalogFilterPanelProps {
  state: CatalogUiState;
  chips: CatalogChip[];
  cityOptions: CatalogSelectOption[];
  /** Options for the currently selected city (all cities when none picked). */
  neighborhoodOptions: CatalogLocationOption[];
  districtOptions: CatalogLocationOption[];
  commercialTypeOptions: CatalogSelectOption[];
  /** Applies a filter patch — pushes the new URL (page resets upstream). */
  onPatch: (patch: Partial<CatalogFilterState>) => void;
  onRemoveChip: (chip: CatalogChip) => void;
  onResetAll: () => void;
  /**
   * Overrides what «Показать объявления» does. Receives the still-uncommitted
   * draft patch (null when nothing is pending) INSTEAD of it being applied via
   * onPatch, so a caller that navigates can fold the drafts into the very URL
   * it pushes. Committing first and navigating after would read state that has
   * not re-rendered yet and silently drop the last edit — the same
   * two-calls-in-one-tick hazard the sheet's merged patch avoids.
   *
   * Omitted on /catalog, where the default (commit + scroll to results) is
   * correct because the results are already on the page.
   */
  onSubmit?: (pending: Partial<CatalogFilterState> | null) => void;
  /** Secondary controls rendered left of «Показать объявления». */
  extraActions?: ReactNode;
}

/** Draft keys: text inputs commit on blur/Enter/submit, never per keystroke. */
interface PanelDrafts {
  search: string;
  priceMin: string;
  priceMax: string;
  houseAreaMin: string;
  houseAreaMax: string;
  houseLandAreaMin: string;
  houseLandAreaMax: string;
  landAreaMin: string;
  landAreaMax: string;
  commercialAreaMin: string;
  commercialAreaMax: string;
}

function draftsFrom(f: CatalogFilterState): PanelDrafts {
  return {
    search: f.search,
    priceMin: f.priceMin,
    priceMax: f.priceMax,
    houseAreaMin: f.houseAreaMin,
    houseAreaMax: f.houseAreaMax,
    houseLandAreaMin: f.houseLandAreaMin,
    houseLandAreaMax: f.houseLandAreaMax,
    landAreaMin: f.landAreaMin,
    landAreaMax: f.landAreaMax,
    commercialAreaMin: f.commercialAreaMin,
    commercialAreaMax: f.commercialAreaMax,
  };
}

/**
 * Desktop filter panel (the mobile entry point is the bottom sheet). The URL
 * is the source of truth: discrete controls (dropdowns, segments) apply
 * instantly; text drafts commit on blur/Enter or via «Показать объявления».
 *
 * The mockup's Продажа/Аренда segmented control is deliberately ABSENT: the
 * backend has a single deal type (sale) and shipping a dead or disabled
 * primary control was rejected — the search field owns the first row instead.
 * Reintroduce the segment only when rent lands in the API.
 */
export function CatalogFilterPanel({
  state,
  chips,
  cityOptions,
  neighborhoodOptions,
  districtOptions,
  commercialTypeOptions,
  onPatch,
  onRemoveChip,
  onResetAll,
  onSubmit,
  extraActions,
}: CatalogFilterPanelProps) {
  const f = state.filters;
  const [drafts, setDrafts] = useState<PanelDrafts>(() => draftsFrom(f));
  const secondaryCount = countSecondaryFilters(f);
  const [moreOpen, setMoreOpen] = useState(secondaryCount > 0);

  /*
   * Resync drafts PER KEY, and only where the APPLIED value actually changed.
   *
   * Blanket `setDrafts(draftsFrom(f))` on every `f` identity change wiped
   * in-progress typing whenever an unrelated navigation committed — the
   * reproducible case is typing while an EARLIER action's server render is
   * still in flight, which on this stack is a multi-second window. Comparing
   * against the PREVIOUS applied value distinguishes "the URL changed this
   * field" (URL wins, resync) from "this field is untouched" (keep the
   * draft). Chip removal, reset and back/forward all still resync, because
   * those DO change the applied value.
   */
  const prevAppliedRef = useRef<CatalogFilterState>(f);
  useEffect(() => {
    const prev = prevAppliedRef.current;
    if (prev === f) return;
    prevAppliedRef.current = f;
    setDrafts((d) => {
      let next: PanelDrafts | null = null;
      for (const key of Object.keys(d) as (keyof PanelDrafts)[]) {
        if (prev[key] !== f[key]) {
          next = next ?? { ...d };
          next[key] = f[key];
        }
      }
      return next ?? d;
    });
  }, [f]);

  // A secondary filter arriving from the URL must be visible, not hidden
  // behind a closed disclosure.
  useEffect(() => {
    if (secondaryCount > 0) setMoreOpen(true);
  }, [secondaryCount]);

  const setDraft = (patch: Partial<PanelDrafts>) =>
    setDrafts((d) => ({ ...d, ...patch }));

  /** Patch of draft keys that differ from the applied state (null = none). */
  const pendingDraftPatch = (): Partial<CatalogFilterState> | null => {
    const patch: Partial<CatalogFilterState> = {};
    let changed = false;
    for (const key of Object.keys(drafts) as (keyof PanelDrafts)[]) {
      if (drafts[key] !== f[key]) {
        patch[key] = drafts[key];
        changed = true;
      }
    }
    return changed ? patch : null;
  };

  const commitDrafts = (extra?: Partial<CatalogFilterState>) => {
    const patch = pendingDraftPatch();
    if (patch || extra) onPatch({ ...(patch ?? {}), ...(extra ?? {}) });
  };

  const commitSearch = () => {
    if (drafts.search !== f.search) onPatch({ search: drafts.search });
  };

  const submit = () => {
    if (onSubmit) {
      onSubmit(pendingDraftPatch());
      return;
    }
    commitDrafts();
    const results = document.getElementById("catalog-results");
    if (results) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      results.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  };

  /* THE RULE (lib/catalogFilters): rooms, market_type and floor_preset all
     read ApartmentDetails, so they need an explicit «Квартиры». Hidden rather
     than disabled under every other type — a control that cannot affect the
     results is noise, and the hero SearchBar has always hidden the same two
     for non-apartments. */
  const showApartmentFilters = apartmentFiltersApply(f);

  return (
    <section
      id="catalog-filter-panel"
      aria-label="Фильтры каталога"
      className="hidden rounded-2xl bg-surface-raised p-5 shadow-panel ring-1 ring-gray-900/5 md:block"
    >
      {/* Search owns the first row (the deal-type segment's former slot). */}
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          commitSearch();
        }}
      >
        <label className="flex h-11 items-center gap-2.5 rounded-xl border border-border bg-surface-raised px-3.5 transition-colors hover:border-border-strong focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
          <Icon icon={Icons.Search} size={16} className="shrink-0 text-gray-400" />
          <input
            type="text"
            value={drafts.search}
            onChange={(e) => setDraft({ search: e.target.value })}
            onBlur={commitSearch}
            placeholder="Адрес, улица или ключевые слова"
            aria-label="Поиск по адресу и описанию"
            className="w-full bg-transparent text-[14px] text-fg outline-none placeholder:text-gray-400"
          />
        </label>
      </form>

      <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-12">
        <CatalogSelect
          label="Тип недвижимости"
          options={PROPERTY_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={f.propertyType}
          onChange={(v) => onPatch({ propertyType: v as CatalogFilterState["propertyType"] })}
          className="col-span-1 lg:col-span-3"
        />
        <CatalogSelect
          label="Город"
          options={cityOptions}
          value={f.citySlug}
          onChange={(v) =>
            // A district belongs to its city — switching or clearing the city
            // always clears the location selection.
            onPatch({ citySlug: v, location: null })
          }
          className="col-span-1 lg:col-span-2"
        />
        <CatalogDistrictCombobox
          neighborhoodOptions={neighborhoodOptions}
          districtOptions={districtOptions}
          value={f.location}
          onChange={(selection) => onPatch({ location: selection })}
          disabled={!f.citySlug}
          className="col-span-1 lg:col-span-2"
        />
        <CatalogPriceFields
          minValue={drafts.priceMin}
          maxValue={drafts.priceMax}
          onMinChange={(raw) => setDraft({ priceMin: raw })}
          onMaxChange={(raw) => setDraft({ priceMax: raw })}
          onCommit={(min, max) => {
            if (min !== f.priceMin || max !== f.priceMax) {
              onPatch({ priceMin: min, priceMax: max });
            } else {
              setDraft({ priceMin: min, priceMax: max });
            }
          }}
          /* Price takes the Комнат columns (11-12) when that control is
             hidden, so the row has no gap at its right edge. */
          className={cn(
            "col-span-2 lg:col-start-8 lg:row-start-1",
            showApartmentFilters ? "lg:col-span-3" : "lg:col-span-5",
          )}
        />
        {showApartmentFilters && (
          <CatalogSelect
            label="Комнат"
            options={ROOMS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={f.rooms}
            onChange={(v) => onPatch({ rooms: v as CatalogFilterState["rooms"] })}
            className="col-span-1 lg:col-span-2 lg:col-start-11 lg:row-start-1"
          />
        )}
      </div>

      {moreOpen && (
        <div
          id="catalog-more-filters"
          className="mt-3.5 flex flex-wrap items-end gap-x-10 gap-y-3 border-t border-gray-100 pt-3.5"
        >
          {showApartmentFilters && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-fg-muted">
                Рынок
              </span>
              <div
                role="group"
                aria-label="Рынок"
                className="flex h-11 items-center gap-1 rounded-xl bg-surface-inset p-1"
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
                        "h-9 rounded-lg px-4 text-[13.5px] transition-colors focus-ring-brand",
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
          )}

          {f.propertyType === "house" && (
            <>
              {/* onCommit receives the от≤до-clamped pair — commit THAT via
                  commitDrafts(extra); the draft state has not re-rendered
                  with the clamp yet (same contract as CatalogPriceFields). */}
              <CatalogAreaFields
                label="Площадь дома"
                unit="м²"
                minValue={drafts.houseAreaMin}
                maxValue={drafts.houseAreaMax}
                onMinChange={(v) => setDraft({ houseAreaMin: v })}
                onMaxChange={(v) => setDraft({ houseAreaMax: v })}
                onCommit={(min, max) =>
                  commitDrafts({ houseAreaMin: min, houseAreaMax: max })
                }
              />
              <CatalogAreaFields
                label="Участок"
                unit="сот."
                minValue={drafts.houseLandAreaMin}
                maxValue={drafts.houseLandAreaMax}
                onMinChange={(v) => setDraft({ houseLandAreaMin: v })}
                onMaxChange={(v) => setDraft({ houseLandAreaMax: v })}
                onCommit={(min, max) =>
                  commitDrafts({ houseLandAreaMin: min, houseLandAreaMax: max })
                }
              />
            </>
          )}

          {f.propertyType === "land" && (
            <CatalogAreaFields
              label="Площадь участка"
              unit="сот."
              minValue={drafts.landAreaMin}
              maxValue={drafts.landAreaMax}
              onMinChange={(v) => setDraft({ landAreaMin: v })}
              onMaxChange={(v) => setDraft({ landAreaMax: v })}
              onCommit={(min, max) =>
                commitDrafts({ landAreaMin: min, landAreaMax: max })
              }
            />
          )}

          {f.propertyType === "commercial" && (
            <>
              <CatalogSelect
                label="Тип помещения"
                options={commercialTypeOptions}
                value={f.commercialType}
                onChange={(v) => onPatch({ commercialType: v })}
                className="w-[220px]"
              />
              <CatalogAreaFields
                label="Площадь"
                unit="м²"
                minValue={drafts.commercialAreaMin}
                maxValue={drafts.commercialAreaMax}
                onMinChange={(v) => setDraft({ commercialAreaMin: v })}
                onMaxChange={(v) => setDraft({ commercialAreaMax: v })}
                onCommit={(min, max) =>
                  commitDrafts({ commercialAreaMin: min, commercialAreaMax: max })
                }
              />
            </>
          )}

          {/* Этаж — same apartments-only rule as Комнат and Рынок above. */}
          {showApartmentFilters && (
            <CatalogSelect
              label="Этаж"
              options={FLOOR_PRESET_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
              value={f.floorPreset}
              onChange={(v) => onPatch({ floorPreset: v as CatalogFloorPreset })}
              className="w-[248px]"
            />
          )}

          {/* Срок сдачи has no backing field anywhere (not on Property, not on
              ApartmentDetails, not on ResidentialComplex) and is DEFERRED by
              product decision — so it stays an honest «Скоро» placeholder
              rather than a dead control. The label is scoped to this one
              control now that Этаж is real. */}
          <div className="flex flex-col gap-1.5 pb-0.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-gray-400">
              Скоро
            </span>
            <span className="flex h-9 items-center rounded-lg border border-dashed border-border-strong px-3.5 text-[13px] text-gray-400">
              Срок сдачи
            </span>
          </div>
        </div>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls="catalog-more-filters"
          onClick={() => setMoreOpen((v) => !v)}
          className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface-raised pl-3.5 pr-3 text-[13.5px] font-semibold text-fg transition-colors hover:border-border-strong focus-ring-brand"
        >
          <Icon icon={Icons.Filters} size={16} className="text-fg-muted" />
          Ещё фильтры
          {secondaryCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-tint px-1 text-[11px] font-bold text-brand">
              {secondaryCount}
            </span>
          )}
          <Icon
            icon={Icons.ChevronDown}
            size={16}
            className={cn("text-gray-400 transition-transform", moreOpen && "rotate-180")}
          />
        </button>
        {extraActions}
        <button
          type="button"
          onClick={submit}
          className="ml-auto flex h-11 items-center gap-2 rounded-xl bg-brand px-6 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover focus-ring-brand"
        >
          <Icon icon={Icons.Search} size={16} />
          {/* Static label on purpose: a live count would refetch the whole
              unpaginated result set per edit. Revisit with a ?count_only
              endpoint. */}
          Показать объявления
        </button>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-3.5">
        <CatalogChipsRow
          chips={chips}
          onRemove={onRemoveChip}
          onResetAll={onResetAll}
          showEmptyText
        />
      </div>
    </section>
  );
}
