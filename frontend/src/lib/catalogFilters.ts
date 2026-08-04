/**
 * Catalog filter/UI state — the URL is the single source of truth.
 *
 * Every filter, the sort order, the list/map view and the page number live in
 * the query string of /catalog. This module is the one place that knows how to
 * parse that query string into typed state and serialize state back, so the
 * server page, the filter panel, the chips row, pagination links and the
 * widen-search actions can never drift apart on param names.
 *
 * Param names match the public API contract in backend/properties/views.py
 * (and the existing buildCatalogQuery in SearchBar.tsx): property_type,
 * search, city_slug, district_slug / neighborhood_slug, rooms / rooms_min,
 * market_type, price_min/max, house_area_*, house_land_area_*, land_area_*,
 * commercial_type, commercial_area_*. UI-only keys: sort, page, view.
 */

import type { CatalogPageSearchRecord } from "@/lib/catalogQueryParams";
import { catalogSearchParamFirst } from "@/lib/catalogQueryParams";
import { digitsOnly, normalizeDecimalInput } from "@/lib/priceDigits";

export type CatalogPropertyTypeFilter =
  | ""
  | "apartment"
  | "house"
  | "land"
  | "commercial";

export type CatalogRoomsValue = "" | "0" | "1" | "2" | "3" | "4" | "4plus";

/**
 * Этаж — presets, not a numeric band: buyers state objections, not ranges.
 * Apartments only (see the emission guard in catalogUiStateToQuery).
 */
export type CatalogFloorPreset =
  | ""
  | "not_first"
  | "not_last"
  | "not_first_not_last";

export type CatalogSortValue = "new" | "price_asc" | "price_desc" | "area_desc";

export type CatalogViewValue = "list" | "map";

export type CatalogLocationKind = "district" | "neighborhood";

export interface CatalogLocationSelection {
  kind: CatalogLocationKind;
  slug: string;
}

export interface CatalogFilterState {
  propertyType: CatalogPropertyTypeFilter;
  citySlug: string;
  /** District/suburb or neighborhood (микрорайон); null = «Все районы». */
  location: CatalogLocationSelection | null;
  search: string;
  rooms: CatalogRoomsValue;
  /** "" | "new_building" | "secondary" | "other" */
  marketType: string;
  /** Этаж preset; only meaningful for apartments. */
  floorPreset: CatalogFloorPreset;
  /** Raw digit strings (no spaces) — the PriceInput convention. */
  priceMin: string;
  priceMax: string;
  /** Loose decimal strings as typed / read from the URL. */
  houseAreaMin: string;
  houseAreaMax: string;
  houseLandAreaMin: string;
  houseLandAreaMax: string;
  landAreaMin: string;
  landAreaMax: string;
  commercialType: string;
  commercialAreaMin: string;
  commercialAreaMax: string;
}

export interface CatalogUiState {
  filters: CatalogFilterState;
  sort: CatalogSortValue;
  /** 1-based. */
  page: number;
  view: CatalogViewValue;
}

/** 9 per page — the mockup's 3×3 grid (product decision, 2026-08-04). */
export const CATALOG_PAGE_SIZE = 9;

export const PROPERTY_TYPE_OPTIONS: {
  value: CatalogPropertyTypeFilter;
  label: string;
}[] = [
  { value: "", label: "Все типы" },
  { value: "apartment", label: "Квартиры" },
  { value: "house", label: "Дома" },
  { value: "land", label: "Участки" },
  { value: "commercial", label: "Коммерция" },
];

export const ROOMS_OPTIONS: { value: CatalogRoomsValue; label: string }[] = [
  { value: "", label: "Любое" },
  { value: "0", label: "Студия" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4plus", label: "4+" },
];

export const MARKET_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Любой" },
  { value: "new_building", label: "Новостройка" },
  { value: "secondary", label: "Вторичка" },
];

export const FLOOR_PRESET_OPTIONS: {
  value: CatalogFloorPreset;
  label: string;
  /** Shorter form for the chip row. */
  chipLabel: string;
}[] = [
  { value: "", label: "Любой", chipLabel: "" },
  { value: "not_first", label: "Не первый", chipLabel: "Этаж: не первый" },
  { value: "not_last", label: "Не последний", chipLabel: "Этаж: не последний" },
  {
    value: "not_first_not_last",
    label: "Не первый и не последний",
    chipLabel: "Этаж: не первый и не последний",
  },
];

/**
 * Этаж is shown ONLY for an explicit «Квартиры» selection — never under «Все
 * типы», where a floor filter would silently turn an all-types search into an
 * apartments-only one (houses and land can never match). The panel, the sheet
 * and the URL serializer all gate on this one predicate.
 */
export function floorFilterApplies(f: CatalogFilterState): boolean {
  return f.propertyType === "apartment";
}

export const SORT_OPTIONS: { value: CatalogSortValue; label: string }[] = [
  { value: "new", label: "Сначала новые" },
  { value: "price_asc", label: "Дешевле" },
  { value: "price_desc", label: "Дороже" },
  { value: "area_desc", label: "По площади" },
];

export function propertyTypeLabel(value: CatalogPropertyTypeFilter): string {
  return PROPERTY_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? "Все типы";
}

export function sortLabel(value: CatalogSortValue): string {
  return SORT_OPTIONS.find((o) => o.value === value)?.label ?? "Сначала новые";
}

/**
 * `ordering` value for the public API. «По площади» has NO API ordering —
 * area lives in four per-type detail tables and is not in ordering_fields —
 * so it returns undefined and the caller sorts the full result set
 * server-side (documented limitation; needs a backend ordering field once
 * the dataset grows).
 */
export function catalogOrderingParam(sort: CatalogSortValue): string | undefined {
  switch (sort) {
    case "price_asc":
      return "price";
    case "price_desc":
      return "-price";
    case "new":
      return "-published_at";
    case "area_desc":
    default:
      return undefined;
  }
}

const EMPTY_FILTERS: CatalogFilterState = {
  propertyType: "",
  citySlug: "",
  location: null,
  search: "",
  rooms: "",
  marketType: "",
  floorPreset: "",
  priceMin: "",
  priceMax: "",
  houseAreaMin: "",
  houseAreaMax: "",
  houseLandAreaMin: "",
  houseLandAreaMax: "",
  landAreaMin: "",
  landAreaMax: "",
  commercialType: "",
  commercialAreaMin: "",
  commercialAreaMax: "",
};

export function emptyCatalogFilters(): CatalogFilterState {
  return { ...EMPTY_FILTERS };
}

function coerceType(raw: string | undefined): CatalogPropertyTypeFilter {
  if (
    raw === "apartment" ||
    raw === "house" ||
    raw === "land" ||
    raw === "commercial"
  ) {
    return raw;
  }
  return "";
}

function coerceRooms(
  rooms: string | undefined,
  roomsMin: string | undefined,
): CatalogRoomsValue {
  const r = rooms?.trim();
  if (r === "0" || r === "1" || r === "2" || r === "3" || r === "4") return r;
  if (roomsMin?.trim() === "4") return "4plus";
  return "";
}

function coerceMarket(raw: string | undefined): string {
  if (raw === "new_building" || raw === "secondary" || raw === "other") return raw;
  return "";
}

function coerceFloorPreset(raw: string | undefined): CatalogFloorPreset {
  if (raw === "not_first" || raw === "not_last" || raw === "not_first_not_last") {
    return raw;
  }
  return "";
}

function coerceSort(raw: string | undefined): CatalogSortValue {
  if (raw === "price_asc" || raw === "price_desc" || raw === "area_desc") return raw;
  return "new";
}

function coercePage(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const n = parseInt(raw, 10);
  return n >= 1 ? n : 1;
}

/** Parse the full catalog UI state from Next.js searchParams. */
export function parseCatalogUiState(sp: CatalogPageSearchRecord): CatalogUiState {
  const first = (k: string) => catalogSearchParamFirst(sp, k);

  const nb = (first("neighborhood_slug") ?? "").trim();
  const ds = (first("district_slug") ?? "").trim();
  const location: CatalogLocationSelection | null = nb
    ? { kind: "neighborhood", slug: nb }
    : ds
      ? { kind: "district", slug: ds }
      : null;

  return {
    filters: {
      propertyType: coerceType(first("property_type")),
      citySlug: (first("city_slug") ?? "").trim(),
      location,
      search: (first("search") ?? "").trim(),
      rooms: coerceRooms(first("rooms"), first("rooms_min")),
      marketType: coerceMarket(first("market_type")),
      floorPreset: coerceFloorPreset(first("floor_preset")),
      priceMin: digitsOnly(first("price_min") ?? ""),
      priceMax: digitsOnly(first("price_max") ?? ""),
      houseAreaMin: (first("house_area_min") ?? "").trim(),
      houseAreaMax: (first("house_area_max") ?? "").trim(),
      houseLandAreaMin: (first("house_land_area_min") ?? "").trim(),
      houseLandAreaMax: (first("house_land_area_max") ?? "").trim(),
      landAreaMin: (first("land_area_min") ?? "").trim(),
      landAreaMax: (first("land_area_max") ?? "").trim(),
      commercialType: (first("commercial_type") ?? "").trim(),
      commercialAreaMin: (first("commercial_area_min") ?? "").trim(),
      commercialAreaMax: (first("commercial_area_max") ?? "").trim(),
    },
    sort: coerceSort(first("sort")),
    page: coercePage(first("page")),
    view: first("view") === "map" ? "map" : "list",
  };
}

/** Client-side variant: URLSearchParams → the same record shape the parser takes. */
export function searchRecordFromParams(
  params: URLSearchParams,
): CatalogPageSearchRecord {
  const out: CatalogPageSearchRecord = {};
  params.forEach((value, key) => {
    if (out[key] === undefined) out[key] = value;
  });
  return out;
}

/**
 * Serialize to the /catalog query string. Defaults are omitted so the
 * canonical unfiltered URL stays bare /catalog: sort=new, page=1 and
 * view=list never appear. Per-type filters are emitted only when the
 * matching property type is selected — mirroring buildCatalogQuery — so a
 * type switch cannot leave orphaned params behind. Exceptions: rooms and
 * market_type are also kept under «Все типы» (they are valid cross-type
 * narrowing on the backend; rooms implies apartments by data shape).
 */
export function catalogUiStateToQuery(state: CatalogUiState): string {
  const q = new URLSearchParams();
  const f = state.filters;

  if (f.propertyType) q.set("property_type", f.propertyType);
  if (f.search.trim()) q.set("search", f.search.trim());
  if (f.citySlug) q.set("city_slug", f.citySlug);
  if (f.location) {
    if (f.location.kind === "neighborhood") {
      q.set("neighborhood_slug", f.location.slug);
    } else {
      q.set("district_slug", f.location.slug);
    }
  }

  const pMin = normalizeDecimalInput(f.priceMin);
  const pMax = normalizeDecimalInput(f.priceMax);
  if (pMin) q.set("price_min", pMin);
  if (pMax) q.set("price_max", pMax);

  if (f.propertyType === "apartment" || f.propertyType === "") {
    if (f.rooms === "4plus") q.set("rooms_min", "4");
    else if (f.rooms !== "") q.set("rooms", f.rooms);
    if (f.marketType) q.set("market_type", f.marketType);
  }

  // Apartments ONLY — never under «Все типы». Because the param is emitted
  // from state rather than copied from the old URL, switching the type away
  // from Квартиры drops it automatically on the next navigation: no orphaned
  // floor_preset can linger and silently filter.
  if (floorFilterApplies(f) && f.floorPreset) {
    q.set("floor_preset", f.floorPreset);
  }

  if (f.propertyType === "house") {
    const a = normalizeDecimalInput(f.houseAreaMin);
    const b = normalizeDecimalInput(f.houseAreaMax);
    if (a) q.set("house_area_min", a);
    if (b) q.set("house_area_max", b);
    const la = normalizeDecimalInput(f.houseLandAreaMin);
    const lb = normalizeDecimalInput(f.houseLandAreaMax);
    if (la) q.set("house_land_area_min", la);
    if (lb) q.set("house_land_area_max", lb);
  }

  if (f.propertyType === "land") {
    const a = normalizeDecimalInput(f.landAreaMin);
    const b = normalizeDecimalInput(f.landAreaMax);
    if (a) q.set("land_area_min", a);
    if (b) q.set("land_area_max", b);
  }

  if (f.propertyType === "commercial") {
    if (f.commercialType) q.set("commercial_type", f.commercialType);
    const a = normalizeDecimalInput(f.commercialAreaMin);
    const b = normalizeDecimalInput(f.commercialAreaMax);
    if (a) q.set("commercial_area_min", a);
    if (b) q.set("commercial_area_max", b);
  }

  if (state.sort !== "new") q.set("sort", state.sort);
  if (state.page > 1) q.set("page", String(state.page));
  if (state.view === "map") q.set("view", "map");

  return q.toString();
}

/** /catalog href for a UI state (bare /catalog when everything is default). */
export function catalogHref(state: CatalogUiState): string {
  const qs = catalogUiStateToQuery(state);
  return qs ? `/catalog?${qs}` : "/catalog";
}

/**
 * A filter mutation resets pagination (page 1) — a new result set has no
 * memory of the old page — and keeps sort/view.
 */
export function withFilters(
  state: CatalogUiState,
  patch: Partial<CatalogFilterState>,
): CatalogUiState {
  return {
    ...state,
    filters: { ...state.filters, ...patch },
    page: 1,
  };
}

/* ----------------------------------------------------------------------------
 * Chips — derived strictly from APPLIED (URL) state, never hardcoded.
 * ------------------------------------------------------------------------- */

export interface CatalogChip {
  key: string;
  label: string;
  /** Filter patch that removes exactly this chip's filter. */
  clear: Partial<CatalogFilterState>;
}

/** Name lookups the chips need; slugs alone would make unreadable labels. */
export interface CatalogChipContext {
  cityName?: (slug: string) => string | undefined;
  locationName?: (kind: CatalogLocationKind, slug: string) => string | undefined;
  commercialTypeLabel?: (value: string) => string | undefined;
}

function groupDigitsLabel(rawDigits: string): string {
  return rawDigits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function areaChip(
  key: string,
  noun: string,
  unit: string,
  min: string,
  max: string,
  clearMin: Partial<CatalogFilterState>,
  clearMax: Partial<CatalogFilterState>,
): CatalogChip[] {
  const chips: CatalogChip[] = [];
  const a = normalizeDecimalInput(min);
  const b = normalizeDecimalInput(max);
  if (a) {
    chips.push({
      key: `${key}_min`,
      label: `${noun} от ${a.replace(".", ",")} ${unit}`,
      clear: clearMin,
    });
  }
  if (b) {
    chips.push({
      key: `${key}_max`,
      label: `${noun} до ${b.replace(".", ",")} ${unit}`,
      clear: clearMax,
    });
  }
  return chips;
}

export function buildCatalogChips(
  f: CatalogFilterState,
  ctx: CatalogChipContext = {},
): CatalogChip[] {
  const chips: CatalogChip[] = [];

  if (f.propertyType) {
    chips.push({
      key: "type",
      label: propertyTypeLabel(f.propertyType),
      clear: { propertyType: "" },
    });
  }
  if (f.citySlug) {
    chips.push({
      key: "city",
      label: ctx.cityName?.(f.citySlug) ?? f.citySlug,
      // Dropping the city also drops the district: a district belongs to its
      // city, so keeping it would silently filter by an invisible location.
      clear: { citySlug: "", location: null },
    });
  }
  if (f.location) {
    const name =
      ctx.locationName?.(f.location.kind, f.location.slug) ?? f.location.slug;
    chips.push({
      key: "location",
      label: f.location.kind === "district" ? `р-н ${name}` : name,
      clear: { location: null },
    });
  }
  if (f.priceMin) {
    chips.push({
      key: "price_min",
      label: `от ${groupDigitsLabel(f.priceMin)} ₽`,
      clear: { priceMin: "" },
    });
  }
  if (f.priceMax) {
    chips.push({
      key: "price_max",
      label: `до ${groupDigitsLabel(f.priceMax)} ₽`,
      clear: { priceMax: "" },
    });
  }
  if ((f.propertyType === "apartment" || f.propertyType === "") && f.rooms) {
    chips.push({
      key: "rooms",
      label:
        f.rooms === "0"
          ? "Студия"
          : f.rooms === "4plus"
            ? "Комнат: 4+"
            : `Комнат: ${f.rooms}`,
      clear: { rooms: "" },
    });
  }
  if ((f.propertyType === "apartment" || f.propertyType === "") && f.marketType) {
    chips.push({
      key: "market",
      label:
        MARKET_OPTIONS.find((o) => o.value === f.marketType)?.label ??
        (f.marketType === "other" ? "Иное" : f.marketType),
      clear: { marketType: "" },
    });
  }
  if (floorFilterApplies(f) && f.floorPreset) {
    chips.push({
      key: "floor_preset",
      label:
        FLOOR_PRESET_OPTIONS.find((o) => o.value === f.floorPreset)?.chipLabel ??
        "Этаж",
      clear: { floorPreset: "" },
    });
  }
  if (f.propertyType === "house") {
    chips.push(
      ...areaChip(
        "house_area",
        "Дом",
        "м²",
        f.houseAreaMin,
        f.houseAreaMax,
        { houseAreaMin: "" },
        { houseAreaMax: "" },
      ),
      ...areaChip(
        "house_land_area",
        "Участок",
        "сот.",
        f.houseLandAreaMin,
        f.houseLandAreaMax,
        { houseLandAreaMin: "" },
        { houseLandAreaMax: "" },
      ),
    );
  }
  if (f.propertyType === "land") {
    chips.push(
      ...areaChip(
        "land_area",
        "Участок",
        "сот.",
        f.landAreaMin,
        f.landAreaMax,
        { landAreaMin: "" },
        { landAreaMax: "" },
      ),
    );
  }
  if (f.propertyType === "commercial") {
    if (f.commercialType) {
      chips.push({
        key: "commercial_type",
        label: ctx.commercialTypeLabel?.(f.commercialType) ?? f.commercialType,
        clear: { commercialType: "" },
      });
    }
    chips.push(
      ...areaChip(
        "commercial_area",
        "Площадь",
        "м²",
        f.commercialAreaMin,
        f.commercialAreaMax,
        { commercialAreaMin: "" },
        { commercialAreaMax: "" },
      ),
    );
  }
  if (f.search.trim()) {
    chips.push({
      key: "search",
      label: `«${f.search.trim()}»`,
      clear: { search: "" },
    });
  }

  return chips;
}

/**
 * Applied secondary («Ещё фильтры») filter count — drives the badge on the
 * disclosure button and its auto-expand on load.
 */
export function countSecondaryFilters(f: CatalogFilterState): number {
  let n = 0;
  if ((f.propertyType === "apartment" || f.propertyType === "") && f.marketType) n++;
  if (floorFilterApplies(f) && f.floorPreset) n++;
  if (f.propertyType === "house") {
    for (const v of [f.houseAreaMin, f.houseAreaMax, f.houseLandAreaMin, f.houseLandAreaMax]) {
      if (normalizeDecimalInput(v)) n++;
    }
  }
  if (f.propertyType === "land") {
    for (const v of [f.landAreaMin, f.landAreaMax]) {
      if (normalizeDecimalInput(v)) n++;
    }
  }
  if (f.propertyType === "commercial") {
    if (f.commercialType) n++;
    for (const v of [f.commercialAreaMin, f.commercialAreaMax]) {
      if (normalizeDecimalInput(v)) n++;
    }
  }
  return n;
}

/* ----------------------------------------------------------------------------
 * Widen-search actions for the 0- and 1-result states. Each action is offered
 * only when it genuinely changes the query, and each produces a real /catalog
 * URL — no dead links.
 * ------------------------------------------------------------------------- */

export interface CatalogWidenAction {
  key: string;
  label: string;
  state: CatalogUiState;
}

/** priceMax × 1.3, rounded up to the nearest 100 000 (mockup: 5 млн → 6,5 млн). */
function widenedPriceMax(rawDigits: string): string {
  const n = Number(rawDigits);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.ceil((n * 1.3) / 100_000) * 100_000);
}

export function buildWidenActions(
  state: CatalogUiState,
  ctx: CatalogChipContext = {},
): CatalogWidenAction[] {
  const f = state.filters;
  const actions: CatalogWidenAction[] = [];

  if (f.location) {
    const name =
      ctx.locationName?.(f.location.kind, f.location.slug) ?? f.location.slug;
    actions.push({
      key: "drop_location",
      label: `Все районы (убрать «${name}»)`,
      state: withFilters(state, { location: null }),
    });
  }
  if (f.priceMax) {
    const widened = widenedPriceMax(f.priceMax);
    if (widened && widened !== f.priceMax) {
      actions.push({
        key: "raise_price",
        label: `Цена до ${groupDigitsLabel(widened)} ₽`,
        state: withFilters(state, { priceMax: widened }),
      });
    }
  }
  if (f.citySlug) {
    actions.push({
      key: "drop_city",
      label: "Все города",
      state: withFilters(state, { citySlug: "", location: null }),
    });
  }
  if ((f.propertyType === "apartment" || f.propertyType === "") && f.rooms) {
    actions.push({
      key: "drop_rooms",
      label: "Любое число комнат",
      state: withFilters(state, { rooms: "" }),
    });
  }
  if (f.search.trim()) {
    actions.push({
      key: "drop_search",
      label: "Убрать поисковый запрос",
      state: withFilters(state, { search: "" }),
    });
  }

  return actions;
}

/**
 * «Расширить поиск» — keep only what the user most deliberately chose (type
 * and city), drop every narrowing condition.
 */
export function widenAllState(state: CatalogUiState): CatalogUiState {
  return {
    ...state,
    page: 1,
    filters: {
      ...EMPTY_FILTERS,
      propertyType: state.filters.propertyType,
      citySlug: state.filters.citySlug,
    },
  };
}

export function resetAllState(state: CatalogUiState): CatalogUiState {
  return { ...state, page: 1, filters: emptyCatalogFilters() };
}
