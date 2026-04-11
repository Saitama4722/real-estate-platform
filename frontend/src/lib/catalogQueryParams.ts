/**
 * Maps Next.js `searchParams` to the public properties API query shape.
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

function catalogOptionalInt(
  sp: CatalogPageSearchRecord,
  key: string,
): number | undefined {
  const raw = catalogSearchParamFirst(sp, key);
  if (!raw?.trim()) return undefined;
  if (!/^\d+$/.test(raw.trim())) return undefined;
  return parseInt(raw.trim(), 10);
}

function catalogOptionalDecimalString(
  sp: CatalogPageSearchRecord,
  key: string,
): string | undefined {
  const raw = catalogSearchParamFirst(sp, key)?.trim();
  if (!raw) return undefined;
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return String(n);
}

const MARKET_TYPES = new Set(["new_building", "secondary", "other"]);

const COMMERCIAL_TYPES = new Set([
  "office",
  "retail",
  "warehouse",
  "production",
  "free_purpose",
  "catering",
]);

/** Params for `fetchPublicPropertiesList({ searchParams })`. Omits UI-only keys (e.g. `view`). */
export function publicPropertiesParamsFromSearchParams(
  sp: CatalogPageSearchRecord,
): Record<string, string | number | undefined> {
  const out: Record<string, string | number | undefined> = {};

  const pt = catalogSearchParamFirst(sp, "property_type");
  if (pt) out.property_type = pt;

  const search = catalogSearchParamFirst(sp, "search");
  if (search?.trim()) out.search = search.trim();

  const citySlug = catalogSearchParamFirst(sp, "city_slug");
  if (citySlug) out.city_slug = citySlug;

  const districtSlug = catalogSearchParamFirst(sp, "district_slug");
  if (districtSlug) out.district_slug = districtSlug;

  const rooms = catalogOptionalInt(sp, "rooms");
  if (rooms !== undefined) out.rooms = rooms;

  const roomsMin = catalogOptionalInt(sp, "rooms_min");
  if (roomsMin !== undefined) out.rooms_min = roomsMin;

  const marketType = catalogSearchParamFirst(sp, "market_type");
  if (marketType && MARKET_TYPES.has(marketType)) out.market_type = marketType;

  const priceMin = catalogOptionalDecimalString(sp, "price_min");
  if (priceMin !== undefined) out.price_min = priceMin;

  const priceMax = catalogOptionalDecimalString(sp, "price_max");
  if (priceMax !== undefined) out.price_max = priceMax;

  const houseAreaMin = catalogOptionalDecimalString(sp, "house_area_min");
  if (houseAreaMin !== undefined) out.house_area_min = houseAreaMin;

  const houseAreaMax = catalogOptionalDecimalString(sp, "house_area_max");
  if (houseAreaMax !== undefined) out.house_area_max = houseAreaMax;

  const houseLandAreaMin = catalogOptionalDecimalString(sp, "house_land_area_min");
  if (houseLandAreaMin !== undefined) out.house_land_area_min = houseLandAreaMin;

  const houseLandAreaMax = catalogOptionalDecimalString(sp, "house_land_area_max");
  if (houseLandAreaMax !== undefined) out.house_land_area_max = houseLandAreaMax;

  const landAreaMin = catalogOptionalDecimalString(sp, "land_area_min");
  if (landAreaMin !== undefined) out.land_area_min = landAreaMin;

  const landAreaMax = catalogOptionalDecimalString(sp, "land_area_max");
  if (landAreaMax !== undefined) out.land_area_max = landAreaMax;

  const commercialType = catalogSearchParamFirst(sp, "commercial_type");
  if (commercialType && COMMERCIAL_TYPES.has(commercialType)) {
    out.commercial_type = commercialType;
  }

  const commercialAreaMin = catalogOptionalDecimalString(sp, "commercial_area_min");
  if (commercialAreaMin !== undefined) out.commercial_area_min = commercialAreaMin;

  const commercialAreaMax = catalogOptionalDecimalString(sp, "commercial_area_max");
  if (commercialAreaMax !== undefined) out.commercial_area_max = commercialAreaMax;

  return out;
}

export function catalogViewIsMap(sp: CatalogPageSearchRecord): boolean {
  return catalogSearchParamFirst(sp, "view") === "map";
}

const SEARCH_BAR_SYNC_KEYS = [
  "property_type",
  "city_slug",
  "district_slug",
  "search",
  "rooms",
  "rooms_min",
  "market_type",
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
