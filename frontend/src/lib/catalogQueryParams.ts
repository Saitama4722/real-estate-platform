/**
 * Next.js `searchParams` plumbing shared by the catalog routes.
 *
 * ⚠ There is deliberately NO raw-searchParams → API-params builder here any
 * more. API params come from `catalogApiParamsFromUiState(parseCatalogUiState(sp))`
 * in lib/catalogFilters.ts — one interpreter for panel, chips AND the API
 * query, sharing the emission gates by construction (review finding 3: the
 * parallel builder here let stale/crafted URLs filter without a chip, and its
 * hardcoded commercial-type whitelist silently dropped the backend's newer
 * hotel/guesthouse values). Do not reintroduce one.
 */

export type CatalogPageSearchRecord = Record<string, string | string[] | undefined>;

export function catalogSearchParamFirst(
  sp: CatalogPageSearchRecord,
  key: string,
): string | undefined {
  const v = sp[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

export function catalogViewIsMap(sp: CatalogPageSearchRecord): boolean {
  return catalogSearchParamFirst(sp, "view") === "map";
}

const SEARCH_BAR_SYNC_KEYS = [
  "property_type",
  "city_slug",
  "district_slug",
  "neighborhood_slug",
  "search",
  "rooms",
  "rooms_min",
  "market_type",
  "floor_preset",
  "price_min",
  "price_max",
  "house_area_min",
  "house_area_max",
  "house_land_area_min",
  "house_land_area_max",
  "land_area_min",
  "land_area_max",
  "commercial_type",
  "commercial_area_min",
  "commercial_area_max",
  "view",
] as const;

export function catalogSearchBarRemountKey(sp: CatalogPageSearchRecord): string {
  return SEARCH_BAR_SYNC_KEYS.map((k) => catalogSearchParamFirst(sp, k) ?? "").join(
    "|",
  );
}
