"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { PropertyCard } from "@/components/home/PropertyCard";
import { CatalogFilterPanel } from "@/components/catalog/CatalogFilterPanel";
import { CatalogFilterSheet } from "@/components/catalog/CatalogFilterSheet";
import { CatalogResultsHeader } from "@/components/catalog/CatalogResultsHeader";
import { CatalogChipsRow } from "@/components/catalog/CatalogChipsRow";
import { CatalogSkeletonGrid } from "@/components/catalog/CatalogSkeletonGrid";
import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import { CatalogEmptyState } from "@/components/catalog/CatalogEmptyState";
import { CatalogSingleResultPanel } from "@/components/catalog/CatalogSingleResult";
import { CatalogStickyBar } from "@/components/catalog/CatalogStickyBar";
import type { CatalogLocationOption } from "@/components/catalog/CatalogDistrictCombobox";
import type { CatalogSelectOption } from "@/components/catalog/CatalogSelect";
import type { CatalogPropertyItem } from "@/components/catalog/types";
import {
  buildCatalogChips,
  buildWidenActions,
  catalogHref,
  resetAllState,
  widenAllState,
  withFilters,
  type CatalogChip,
  type CatalogChipContext,
  type CatalogFilterState,
  type CatalogUiState,
} from "@/lib/catalogFilters";
import type { CatalogLocationData } from "@/lib/publicLocations";
import { groupDigits } from "@/lib/priceDigits";
import { parsePropertyListPriceRub } from "@/lib/similarProperties";
import { hasCatalogItemMapCoords } from "@/lib/mapCoordinates";

// Leaflet/react-leaflet touch `window` at module-eval time, so the map must be
// client-only — `next/dynamic({ ssr: false })`, not `React.lazy` (which still
// runs on the server and throws "window is not defined").
const CatalogMapLazy = dynamic(
  () =>
    import("@/components/catalog/CatalogMap").then((mod) => ({
      default: mod.CatalogMap,
    })),
  { ssr: false },
);

interface CatalogExplorerProps {
  /** Parsed from the URL by the server page — always in sync with it. */
  uiState: CatalogUiState;
  /** Current page slice of the sorted result set (server-sliced for SSR). */
  pageItems: CatalogPropertyItem[];
  /** The full sorted result set — the map shows everything, not one page. */
  allItems: CatalogPropertyItem[];
  totalCount: number;
  totalPages: number;
  locationData: CatalogLocationData;
}

/** «12 345 ₽/м²» from the formatted price + numeric area; rounded to 100. */
function pricePerM2(item: CatalogPropertyItem): string | undefined {
  if (!item.area || item.area <= 0) return undefined;
  const price = parsePropertyListPriceRub(item.price);
  if (!Number.isFinite(price) || price <= 0) return undefined;
  const perM2 = Math.round(price / item.area / 100) * 100;
  if (perM2 <= 0) return undefined;
  return `${groupDigits(String(perM2))} ₽/м²`;
}

/**
 * Client orchestrator of the catalog page. Owns NO filter state of its own:
 * every mutation is a router.push of a new /catalog URL inside a transition,
 * and the server component re-renders the results for that URL. isPending
 * drives the real skeleton state; back/forward, reload and shared URLs work
 * by construction.
 */
export function CatalogExplorer({
  uiState,
  pageItems,
  allItems,
  totalCount,
  totalPages,
  locationData,
}: CatalogExplorerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);

  const f = uiState.filters;

  /* ---- Option lists & label context from the location dictionaries ------- */

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

  /* ---- Navigation: every mutation is a URL push in a transition ---------- */

  const scrollToResults = useCallback(() => {
    const el = document.getElementById("catalog-results");
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, []);

  const navigate = useCallback(
    (state: CatalogUiState, opts?: { toResults?: boolean }) => {
      const href = catalogHref(state);
      /*
       * Create the history entry SYNCHRONOUSLY, before the transition.
       * `router.push` inside startTransition defers its pushState until the
       * transition COMMITS — so while a slow RSC render is pending there is
       * no entry for the target URL yet, and a Back press in that window
       * pops PAST the catalog and leaves the site entirely [measured:
       * back_diag.py variant B landed on about:blank]. Next 15 syncs its
       * router with native history.pushState, so the entry exists the
       * instant the user clicks; the transition then `replace`s onto that
       * same entry with the fresh server render.
       */
      window.history.pushState(null, "", href);
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
      if (opts?.toResults) scrollToResults();
    },
    [router, scrollToResults],
  );

  const patchFilters = useCallback(
    (patch: Partial<CatalogFilterState>) => navigate(withFilters(uiState, patch)),
    [navigate, uiState],
  );

  const removeChip = useCallback(
    (chip: CatalogChip) => patchFilters(chip.clear),
    [patchFilters],
  );

  const resetAll = useCallback(
    () => navigate(resetAllState(uiState)),
    [navigate, uiState],
  );

  /* ---- Sticky condensed bar: rAF-throttled position sweep (never IO) ----- */

  const tickingRef = useRef(false);
  useEffect(() => {
    const measure = () => {
      tickingRef.current = false;
      // Past-the-panel on desktop; past the results top on mobile, where the
      // panel is display:none (its rect would read all zeros — don't use it).
      const panel = document.getElementById("catalog-filter-panel");
      const results = document.getElementById("catalog-results");
      const threshold = 60; // compact header (52px) + breathing room
      let visible = false;
      if (panel && panel.offsetParent !== null) {
        visible = panel.getBoundingClientRect().bottom < threshold;
      } else if (results) {
        visible = results.getBoundingClientRect().top < threshold;
      }
      setStickyVisible(visible);
    };
    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const openFiltersFromBar = useCallback(() => {
    if (window.innerWidth < 768) {
      setSheetOpen(true);
      return;
    }
    const panel = document.getElementById("catalog-filter-panel");
    if (!panel) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, []);

  /* ---- Derived result-state pieces --------------------------------------- */

  const mapItems = useMemo(() => allItems.filter(hasCatalogItemMapCoords), [allItems]);
  const widenActions = useMemo(
    () => buildWidenActions(uiState, chipCtx),
    [uiState, chipCtx],
  );

  const renderCard = (item: CatalogPropertyItem) => (
    <PropertyCard
      key={item.id}
      slug={item.slug}
      image={item.image}
      price={item.price}
      pricePerM2={pricePerM2(item)}
      oldPrice={item.oldPrice}
      marketLabel={item.marketLabel}
      title={item.title}
      characteristics={item.characteristics}
      rooms={item.rooms}
      area={item.area}
      floor={item.floor}
      totalFloors={item.totalFloors}
      location={item.location}
      href={item.href}
      favoriteId={item.slug}
      isPriceReduced={item.isPriceReduced}
      compareId={item.slug}
      compareType={item.propertyType}
    />
  );

  return (
    <>
      <CatalogFilterPanel
        state={uiState}
        chips={chips}
        cityOptions={cityOptions}
        neighborhoodOptions={neighborhoodOptions}
        districtOptions={districtOptions}
        commercialTypeOptions={commercialTypeOptions}
        onPatch={patchFilters}
        onRemoveChip={removeChip}
        onResetAll={resetAll}
      />

      <section
        id="catalog-results"
        aria-label="Результаты поиска"
        aria-busy={isPending}
        className="mt-6 scroll-mt-[76px]"
      >
        <CatalogResultsHeader
          total={totalCount}
          filtersCount={chips.length}
          sort={uiState.sort}
          view={uiState.view}
          onSortChange={(sort) => navigate({ ...uiState, sort, page: 1 })}
          onViewChange={(view) => navigate({ ...uiState, view })}
          onOpenSheet={() => setSheetOpen(true)}
        />

        {/* Mobile chips live under the results header (the panel is hidden). */}
        <div className="mt-3 md:hidden">
          <CatalogChipsRow chips={chips} onRemove={removeChip} onResetAll={resetAll} />
        </div>

        {isPending ? (
          <CatalogSkeletonGrid count={Math.min(6, Math.max(3, pageItems.length || 6))} />
        ) : uiState.view === "map" ? (
          mapItems.length === 0 ? (
            <div className="mt-5 h-64 rounded-2xl border border-dashed border-border-strong bg-gray-50 md:h-80">
              <div className="flex h-full items-center justify-center px-4 text-center text-body text-fg-muted">
                Нет объектов с координатами для отображения на карте
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <Suspense
                fallback={
                  <div className="ctr-skel h-[440px] w-full rounded-2xl" />
                }
              >
                <CatalogMapLazy properties={mapItems} />
              </Suspense>
            </div>
          )
        ) : totalCount === 0 ? (
          <CatalogEmptyState
            actions={widenActions}
            resetState={resetAllState(uiState)}
            onNavigate={navigate}
          />
        ) : totalCount === 1 && widenActions.length > 0 ? (
          /* One result: the card + the widen-search panel fill the row together. */
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {pageItems.map(renderCard)}
            <CatalogSingleResultPanel
              actions={widenActions}
              widenAllState={widenAllState(uiState)}
              onNavigate={navigate}
            />
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {pageItems.map(renderCard)}
            </div>
            <CatalogPagination
              currentPage={uiState.page}
              totalPages={totalPages}
              hrefForPage={(page) => catalogHref({ ...uiState, page })}
              onNavigate={(page, e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
                  return; // new-tab / download intents keep native link behaviour
                }
                e.preventDefault();
                navigate({ ...uiState, page }, { toResults: true });
              }}
            />
          </>
        )}
      </section>

      <CatalogStickyBar
        visible={stickyVisible}
        chips={chips}
        total={totalCount}
        onOpenFilters={openFiltersFromBar}
      />

      <CatalogFilterSheet
        open={sheetOpen}
        state={uiState}
        cityOptions={cityOptions}
        neighborhoodOptions={neighborhoodOptions}
        districtOptions={districtOptions}
        commercialTypeOptions={commercialTypeOptions}
        onPatch={patchFilters}
        onResetAll={resetAll}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
