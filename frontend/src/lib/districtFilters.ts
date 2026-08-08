/**
 * District-guide index state — the URL is the single source of truth, same
 * contract as lib/articleFilters.ts and lib/catalogFilters.ts.
 *
 * Guides have TWO independent facets where articles have one: the city and the
 * kind of area. They combine with AND, each has its own «Все», and both live
 * in the query string so a narrowed view is shareable.
 */

import type { PublicDistrictGuide } from "@/lib/publicDistrictGuides";

/** City facet values ARE the real City.slug values — append-only. */
export const DISTRICT_CITY_OPTIONS: { value: string; label: string }[] = [
  { value: "krasnodar", label: "Краснодар" },
  { value: "gelendzhik", label: "Геленджик" },
];

/**
 * Kind facet. A guide targets either a District or a Neighborhood — the
 * backend already tells us which via `catalogParam`, so this is derived, never
 * guessed (see the District-vs-Neighborhood note in CLAUDE.md).
 */
export const DISTRICT_KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "rayon", label: "Район" },
  { value: "mikrorayon", label: "Микрорайон" },
];

export function guideKindValue(guide: PublicDistrictGuide): string {
  return guide.catalogParam === "neighborhood_slug" ? "mikrorayon" : "rayon";
}

export function guideKindLabel(guide: PublicDistrictGuide): string {
  return guideKindValue(guide) === "mikrorayon" ? "Микрорайон" : "Район";
}

/** 14 — one full pass of the card-span rhythm, as on /articles. */
export const DISTRICTS_PAGE_SIZE = 14;

/** The two city overview guides: the page's entry points, not "the newest". */
export const DISTRICT_OVERVIEW_SLUGS = ["krasnodar-obzor", "gelendzhik-obzor"];

export interface DistrictsUiState {
  /** City slug, or "" for «Все». */
  city: string;
  /** "rayon" | "mikrorayon" | "" for «Все». */
  kind: string;
  /** 1-based. */
  page: number;
}

export type DistrictsPageSearchRecord = Record<
  string,
  string | string[] | undefined
>;

function firstParam(
  sp: DistrictsPageSearchRecord,
  key: string,
): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

function coerceFrom(
  options: { value: string }[],
  raw: string | undefined,
): string {
  if (!raw) return "";
  return options.some((o) => o.value === raw) ? raw : "";
}

function coercePage(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const n = parseInt(raw, 10);
  return n >= 1 ? n : 1;
}

export function parseDistrictsUiState(
  sp: DistrictsPageSearchRecord,
): DistrictsUiState {
  return {
    city: coerceFrom(DISTRICT_CITY_OPTIONS, firstParam(sp, "city")),
    kind: coerceFrom(DISTRICT_KIND_OPTIONS, firstParam(sp, "kind")),
    page: coercePage(firstParam(sp, "page")),
  };
}

/** Defaults omitted, so the canonical URL stays a bare /districts. */
export function districtsUiStateToQuery(state: DistrictsUiState): string {
  const q = new URLSearchParams();
  if (state.city) q.set("city", state.city);
  if (state.kind) q.set("kind", state.kind);
  if (state.page > 1) q.set("page", String(state.page));
  return q.toString();
}

export function districtsHref(state: DistrictsUiState): string {
  const qs = districtsUiStateToQuery(state);
  return qs ? `/districts?${qs}` : "/districts";
}

/** Counts for one facet, computed against the OTHER facet's active value. */
export function districtFacetCounts(
  guides: PublicDistrictGuide[],
  facet: "city" | "kind",
  otherActive: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const g of guides) {
    const city = g.city?.slug ?? "";
    const kind = guideKindValue(g);
    // A chip's count must describe what clicking it actually yields, so it is
    // narrowed by whatever the other facet is currently set to.
    if (facet === "city") {
      if (otherActive && kind !== otherActive) continue;
      counts.set(city, (counts.get(city) ?? 0) + 1);
    } else {
      if (otherActive && city !== otherActive) continue;
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
  }
  return counts;
}

export function filterGuides(
  guides: PublicDistrictGuide[],
  state: DistrictsUiState,
): PublicDistrictGuide[] {
  return guides.filter((g) => {
    if (state.city && (g.city?.slug ?? "") !== state.city) return false;
    if (state.kind && guideKindValue(g) !== state.kind) return false;
    return true;
  });
}
