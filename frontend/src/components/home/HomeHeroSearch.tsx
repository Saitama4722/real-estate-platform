"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, Icons } from "@/components/ui/icon";
import { CatalogFilterPanel } from "@/components/catalog/CatalogFilterPanel";
import { CatalogFilterSheet } from "@/components/catalog/CatalogFilterSheet";
import { CatalogChipsRow } from "@/components/catalog/CatalogChipsRow";
import type { CatalogSelectOption } from "@/components/catalog/CatalogSelect";
import type { CatalogLocationOption } from "@/components/catalog/CatalogDistrictCombobox";
import {
  buildCatalogChips,
  catalogHref,
  countSecondaryFilters,
  parseCatalogUiState,
  resetAllState,
  withFilters,
  type CatalogChip,
  type CatalogChipContext,
  type CatalogFilterState,
  type CatalogUiState,
} from "@/lib/catalogFilters";
import type { CatalogLocationData } from "@/lib/publicLocations";

interface HomeHeroSearchProps {
  /**
   * Fetched ON THE SERVER by the homepage and passed down — the whole point of
   * this component. The hero previously fetched cities/districts from the
   * browser through the Next.js `/api` rewrite, which meant the Город dropdown
   * held nothing but «Все города» until that round-trip landed (~19s on a cold
   * Railway render [measured 2026-08-14]) and held nothing at all whenever the
   * rewrite pointed at a stale backend port. Server-rendered options have
   * neither failure mode.
   */
  locationData: CatalogLocationData;
}

/**
 * The homepage hero search — the SAME controls as /catalog, driven by the same
 * `lib/catalogFilters` state module, so a filter cannot mean one thing here and
 * another there.
 *
 * The one real difference from `CatalogExplorer`: there are no results on this
 * page to re-render, so state is LOCAL (`useState`) instead of the URL, and
 * «Показать объявления» navigates to the /catalog URL that state serializes to.
 * Everything else — option lists, chips, the apartments-only rule, the mobile
 * sheet — is the catalog's own code path, not a parallel implementation.
 */
export function HomeHeroSearch({ locationData }: HomeHeroSearchProps) {
  const router = useRouter();
  // parseCatalogUiState({}) rather than a hand-built literal: defaults then
  // come from THE single URL interpreter and cannot drift from /catalog's.
  const [state, setState] = useState<CatalogUiState>(() => parseCatalogUiState({}));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");

  const f = state.filters;

  /* ---- Option lists & chip labels — identical derivation to the catalog --- */

  const cityOptions = useMemo<CatalogSelectOption[]>(
    () => [
      { value: "", label: "Все города" },
      ...locationData.cities.map((c) => ({ value: c.slug, label: c.name })),
    ],
    [locationData.cities],
  );

  const neighborhoodOptions = useMemo<CatalogLocationOption[]>(
    () =>
      locationData.neighborhoods
        .filter((n) => !f.citySlug || n.city?.slug === f.citySlug)
        .map((n) => ({ kind: "neighborhood" as const, slug: n.slug, name: n.name })),
    [locationData.neighborhoods, f.citySlug],
  );

  const districtOptions = useMemo<CatalogLocationOption[]>(
    () =>
      locationData.districts
        .filter((d) => !f.citySlug || d.city?.slug === f.citySlug)
        .map((d) => ({ kind: "district" as const, slug: d.slug, name: d.name })),
    [locationData.districts, f.citySlug],
  );

  const commercialTypeOptions = useMemo<CatalogSelectOption[]>(
    () => [
      { value: "", label: "Любой" },
      ...locationData.commercialTypes.map((c) => ({ value: c.value, label: c.label })),
    ],
    [locationData.commercialTypes],
  );

  const chipCtx = useMemo<CatalogChipContext>(
    () => ({
      cityName: (slug) => locationData.cities.find((c) => c.slug === slug)?.name,
      locationName: (kind, slug) =>
        kind === "district"
          ? locationData.districts.find((d) => d.slug === slug)?.name
          : locationData.neighborhoods.find((n) => n.slug === slug)?.name,
      commercialTypeLabel: (value) =>
        locationData.commercialTypes.find((c) => c.value === value)?.label,
    }),
    [locationData],
  );

  const chips = useMemo(() => buildCatalogChips(f, chipCtx), [f, chipCtx]);

  /* ---- Mutations: plain local state, no URL until submit ------------------ */

  const patchFilters = useCallback(
    (patch: Partial<CatalogFilterState>) =>
      setState((s) => withFilters(s, patch)),
    [],
  );

  const removeChip = useCallback(
    (chip: CatalogChip) => patchFilters(chip.clear),
    [patchFilters],
  );

  const resetAll = useCallback(() => {
    setState((s) => resetAllState(s));
    setSearchDraft("");
  }, []);

  /**
   * Go to /catalog for the current filters, folding in any patch still sitting
   * in a child's drafts. The patch is applied to the href directly rather than
   * committed first: `setState` would not have re-rendered by the time we read
   * `state` again in the same handler, so committing-then-navigating drops the
   * last edit.
   */
  const submit = useCallback(
    (pending?: Partial<CatalogFilterState> | null) => {
      const next = pending ? withFilters(state, pending) : state;
      setState(next);
      router.push(catalogHref(next));
    },
    [router, state],
  );

  const scrollToHomeMap = useCallback(() => {
    const el = document.getElementById("home-map");
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, []);

  // Committing the mobile draft before the sheet opens keeps the two surfaces
  // from disagreeing — the sheet has no search field of its own, so a typed but
  // uncommitted query would otherwise be lost by the sheet's own submit.
  const openSheet = useCallback(() => {
    if (searchDraft !== f.search) patchFilters({ search: searchDraft });
    setSheetOpen(true);
  }, [searchDraft, f.search, patchFilters]);

  const mapButton = (
    <button
      type="button"
      onClick={scrollToHomeMap}
      className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface-raised px-3.5 text-[13.5px] font-semibold text-fg transition-colors hover:border-border-strong focus-ring-brand"
    >
      <Icon icon={Icons.Map} size={16} className="text-fg-muted" />
      На карте
    </button>
  );

  const secondaryCount = countSecondaryFilters(f);

  return (
    <>
      <CatalogFilterPanel
        state={state}
        chips={chips}
        cityOptions={cityOptions}
        neighborhoodOptions={neighborhoodOptions}
        districtOptions={districtOptions}
        commercialTypeOptions={commercialTypeOptions}
        onPatch={patchFilters}
        onRemoveChip={removeChip}
        onResetAll={resetAll}
        onSubmit={submit}
        extraActions={mapButton}
      />

      {/*
       * Mobile entry point. /catalog gets its «Фильтры» button from the results
       * header and its sticky bar; the homepage has neither, so the hero needs
       * its own — otherwise the panel's `hidden md:block` would leave phones
       * with no search at all.
       */}
      <div className="rounded-2xl bg-surface-raised p-4 shadow-panel ring-1 ring-gray-900/5 md:hidden">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            submit(searchDraft !== f.search ? { search: searchDraft } : null);
          }}
        >
          <label className="flex h-11 items-center gap-2.5 rounded-xl border border-border bg-surface-raised px-3.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
            <Icon icon={Icons.Search} size={16} className="shrink-0 text-gray-400" />
            <input
              type="text"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Адрес, улица или ключевые слова"
              aria-label="Поиск по адресу и описанию"
              className="w-full bg-transparent text-[14px] text-fg outline-none placeholder:text-gray-400"
            />
          </label>
        </form>

        <div className="mt-3 flex items-center gap-2.5">
          <button
            type="button"
            onClick={openSheet}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface-raised px-3.5 text-[13.5px] font-semibold text-fg transition-colors hover:border-border-strong focus-ring-brand"
          >
            <Icon icon={Icons.Filters} size={16} className="text-fg-muted" />
            Фильтры
            {secondaryCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-tint px-1 text-[11px] font-bold text-brand">
                {secondaryCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() =>
              submit(searchDraft !== f.search ? { search: searchDraft } : null)
            }
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover focus-ring-brand"
          >
            <Icon icon={Icons.Search} size={16} />
            Найти
          </button>
        </div>

        {chips.length > 0 && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <CatalogChipsRow chips={chips} onRemove={removeChip} onResetAll={resetAll} />
          </div>
        )}
      </div>

      <CatalogFilterSheet
        open={sheetOpen}
        state={state}
        cityOptions={cityOptions}
        neighborhoodOptions={neighborhoodOptions}
        districtOptions={districtOptions}
        commercialTypeOptions={commercialTypeOptions}
        onPatch={patchFilters}
        onResetAll={resetAll}
        onClose={() => setSheetOpen(false)}
        onSubmit={submit}
      />
    </>
  );
}
