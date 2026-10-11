/**
 * Leaflet-free constants and types for the address picker.
 *
 * ⚠ THIS FILE EXISTS SPECIFICALLY SO NOTHING HAS TO STATICALLY IMPORT THE MAP
 * MODULE. `next/dynamic({ssr:false})` defers the COMPONENT, but it does not stop
 * a plain `import { SOME_CONSTANT } from "./AddressPickerMap"` from pulling that
 * module — and therefore `leaflet`, which reads `window` at module-evaluation
 * time — into the SERVER bundle. Doing exactly that produced a hard
 * `Error: window is not defined` and a 500 on /sell `[measured]`, even though
 * the component itself was correctly loaded with ssr:false.
 *
 * Keep this file free of any Leaflet import, forever.
 */

import serviceArea from "@/shared/serviceArea.json";

export type LatLng = { lat: number; lng: number };

/**
 * ⭐ TILES ARE OPENSTREETMAP, NOT 2GIS.
 *
 * Geocoding moved to Nominatim (see `lib/addressSuggest.ts`) while the tile
 * layer was left behind, so every map still rendered "© 2GIS" over
 * OSM-geocoded pins — attribution naming a provider that supplies nothing on
 * the page. These two constants are the ONE definition; import them rather
 * than retyping a URL, so the next provider change is a single edit.
 *
 * ⚠ No `{s}` subdomain: OSM deprecated the a/b/c subdomains and serves HTTP/2
 * from the bare host. ⚠ The attribution string is REQUIRED by the OSM tile
 * usage policy and must stay a real link.
 */
export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
export const OSM_MAX_ZOOM = 19;

/**
 * ⭐⭐ THE SERVICE AREA IS A UNION OF PER-SETTLEMENT CIRCLES, NOT A RECTANGLE.
 *
 * ⚠ RECTANGLES WERE TRIED AND REJECTED — do not reintroduce one, not even as an
 * extra filter. The Krasnodar округ is too dispersed: a box holding all 72 of
 * its dropdown rows runs from х. Дальний (45.404) down to ст. Григорьевская and
 * east to ст. Михайловская (39.622), and on the way it swallows Усть-Лабинск,
 * Абинск and Крымск — towns the platform does not serve. A circle per
 * settlement follows the shape of the actual coverage instead of its extremes.
 *
 * Values come from `src/shared/serviceArea.json`, which is GENERATED from the
 * Город/Район dropdown (the authoritative definition of scope) and mirrored by
 * `backend/common/city_bounds.py`. `backend/common/tests.py` asserts the two
 * agree and that no dropdown row gains coordinates without gaining a circle.
 */
export type ServiceCircle = {
  name: string;
  city: string;
  center: LatLng;
  radiusKm: number;
  kind: string;
  /**
   * TRUE for a real settlement (a `District` row with `district_type="suburb"`
   * in the Django model — Бетта, Кабардинка, ст. Динская…). FALSE for a
   * microdistrict/subdivision of a city (a `Neighborhood` row —
   * Витаминкомбинат, Дубинка, Южный in Геленджик…).
   *
   * ⛔ THIS FIELD NO LONGER AFFECTS SEARCH SCOPE, AND MUST NOT AGAIN.
   * It used to decide "search this settlement" vs "search the parent city",
   * and that is the bug fixed on 2026-09-01: the scope is now ALWAYS the whole
   * city for every row type (see `resolveArea`). The field stays because it is
   * generated from the fixture and asserted by `backend/common/tests.py`; it is
   * descriptive data, not a switch. ⚠ Do not re-wire it into `/geo/suggest`.
   *
   * ⚠ SOURCED FROM THE DJANGO MODEL, NEVER FROM OSM'S PLACE TYPE. The two
   * disagree constantly: «Южный» (a Gelendzhik MICRODISTRICT) resolves to
   * OSM kind="town", and «Голубая бухта» (a genuine STANDALONE settlement)
   * resolves to OSM kind="suburb" — exactly backwards from what the English
   * words suggest. `kind` above is kept only for radius sizing.
   */
  standalone: boolean;
};

type RawCity = { lat: number; lon: number; radiusKm: number; kind: string };
type RawSettlement = RawCity & { city: string; standalone: boolean };

const CITY_CIRCLES: ServiceCircle[] = Object.entries(
  serviceArea.cities as Record<string, RawCity>,
).map(([name, v]) => ({
  name,
  city: name,
  center: { lat: v.lat, lng: v.lon },
  radiusKm: v.radiusKm,
  kind: "city",
  standalone: true,
}));

const SETTLEMENT_CIRCLES: ServiceCircle[] = Object.entries(
  serviceArea.settlements as Record<string, RawSettlement>,
).map(([name, v]) => ({
  name,
  city: v.city,
  center: { lat: v.lat, lng: v.lon },
  radiusKm: v.radiusKm,
  kind: v.kind,
  standalone: v.standalone,
}));

/** Every circle. A point is in the service area iff it is inside ANY of them. */
export const ALL_CIRCLES: ServiceCircle[] = [
  ...CITY_CIRCLES,
  ...SETTLEMENT_CIRCLES,
];

/**
 * Dropdown rows with no circle, and WHY — the three reasons behave differently:
 *  · `microdistrict` — inside its city by construction, city circle covers it;
 *  · `unmapped`      — absent from OSM entirely (п. Титоровка, х. Навагинка):
 *                      the address can be typed, but a map pin there would fall
 *                      outside every circle and be rejected;
 *  · `container`     — «Микрорайоны Краснодара», a grouping row, not a place.
 */
export type NoCircleReason = "microdistrict" | "unmapped" | "container";

/** The dropdown appends " (микрорайон)" to neighborhood rows; keys omit it. */
function settlementKey(name: string): string {
  return name.replace(/\s*\(микрорайон\)\s*$/u, "").trim();
}

export const SETTLEMENTS_WITHOUT_CIRCLE = serviceArea.settlementsWithoutCircle as Record<
  string,
  { reason: NoCircleReason; city?: string; note: string }
>;

/**
 * Grouping rows that are NOT places — «Микрорайоны Краснодара» is a container
 * for the microdistricts beneath it, not somewhere anyone lives. It must never
 * reach the geocoder or the map, so the /sell form filters it out of the
 * Район selector entirely.
 */
export const CONTAINER_ROWS: string[] = Object.entries(
  SETTLEMENTS_WITHOUT_CIRCLE,
).filter(([, v]) => v.reason === "container").map(([name]) => name);

export function isContainerRow(name: string): boolean {
  return CONTAINER_ROWS.includes(settlementKey(name));
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function isInsideCircle(lat: number, lon: number, c: ServiceCircle): boolean {
  return distanceKm({ lat, lng: lon }, c.center) <= c.radiusKm;
}

/**
 * The NEAREST circle that contains the point, else null.
 *
 * ⚠ THIS IS THE COORDINATE-VALIDATION PRIMITIVE AND ITS SEMANTICS ARE FROZEN:
 * a point is in the service area iff it is inside ANY circle, whichever city
 * that circle belongs to. The 2026-09-01 "search the whole city" change did not
 * touch it — a pin dropped in a rural settlement 30 km from its city centre is
 * still valid, exactly as before.
 */
export function circleForPoint(lat: number, lon: number): ServiceCircle | null {
  let best: ServiceCircle | null = null;
  let bestD = Infinity;
  for (const c of ALL_CIRCLES) {
    const d = distanceKm({ lat, lng: lon }, c.center);
    if (d <= c.radiusKm && d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

/** The city owning the NEAREST circle that contains the point, else null. */
export function cityForPoint(lat: number, lon: number): string | null {
  return circleForPoint(lat, lon)?.city ?? null;
}

export function isInServiceArea(lat: number, lon: number): boolean {
  return cityForPoint(lat, lon) !== null;
}

/**
 * A bounding box around a circle — ONLY as a query hint for Nominatim, which
 * takes a viewbox and not a radius. ⚠ The circle stays authoritative: results
 * are re-filtered by true distance, because this box is by construction larger
 * than the circle it came from (it is the circumscribing rectangle).
 */
export function viewboxForCircle(c: ServiceCircle): string {
  return viewboxForCircles([c]);
}

/**
 * ⭐ The box circumscribing a WHOLE SET of circles — the search scope of an
 * entire city (its own circle plus every settlement belonging to it).
 *
 * ⚠ THIS IS A HINT, NOT THE TEST, AND THE DISTINCTION IS LOAD-BEARING. The box
 * around all of Краснодар's coverage is ~55 km across and does swallow
 * Усть-Лабинск, Абинск and Крымск — towns the platform does not serve. That is
 * fine ONLY because `/geo/suggest` re-filters every result against the union of
 * the circles afterwards. ⛔ Never promote this rectangle to the membership
 * test; that is the exact mistake `serviceArea.json` exists to avoid.
 */
export function viewboxForCircles(circles: ServiceCircle[]): string {
  let west = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  let south = Infinity;
  for (const c of circles) {
    const dLat = c.radiusKm / 111.32;
    const dLon = c.radiusKm / (111.32 * Math.cos((c.center.lat * Math.PI) / 180));
    north = Math.max(north, c.center.lat + dLat);
    south = Math.min(south, c.center.lat - dLat);
    west = Math.min(west, c.center.lng - dLon);
    east = Math.max(east, c.center.lng + dLon);
  }
  // Nominatim order: left,top,right,bottom (lon,lat,lon,lat).
  return `${west},${north},${east},${south}`;
}

/**
 * The name to hand a GEOCODER, without our dropdown's type abbreviation.
 *
 * ⚠ The dropdown stores «ст. Динская», «п. Энем», «х. Ленина». Nominatim's
 * `city=` matches a place NAME, so the prefix makes it match nothing — three
 * stanitsas returned zero suggestions for streets OSM demonstrably has
 * `[measured]`. Бетта hid this because its row has no prefix.
 */
export function bareLocality(name: string): string {
  return settlementKey(name)
    .replace(/^(?:ст\.|п\.|х\.|пгт|аул|СНТ|с\.|д\.|г\.)\s+/iu, "")
    .trim();
}

export function circleFor(areaName: string): ServiceCircle | undefined {
  const n = settlementKey(areaName);
  return SETTLEMENT_CIRCLES.find((c) => c.name === n);
}

export function cityCircle(cityName: string): ServiceCircle | undefined {
  return CITY_CIRCLES.find((c) => c.name === cityName);
}

/**
 * ⭐⭐ THE SEARCH SCOPE OF A CITY: its own circle PLUS every settlement circle
 * that belongs to it. This — not the city circle alone — is what "the whole
 * city" means here.
 *
 * ⚠ THE CITY CIRCLE ALONE IS NOT ENOUGH, and the numbers say so loudly:
 * 42 of Краснодар's 75 dropdown settlements and 12 of Геленджик's 26 lie
 * OUTSIDE their city circle `[measured]` — ст. Динская 28.1 km out,
 * п. Северный 29.9, Бетта 32.4, Кабардинка 15.2, against radii of 16.0 and
 * 10.0 km. Scoping to the city circle would silently delete every one of those
 * settlements' streets from the results, which is the same class of bug as
 * scoping to the Район, just pointing the other way.
 */
export function circlesForCity(cityName: string): ServiceCircle[] {
  if (!cityName) return [];
  return ALL_CIRCLES.filter((c) => c.city === cityName);
}

export type ResolvedArea = {
  /**
   * ⭐⭐ THE SEARCH SCOPE — the selected city's ENTIRE coverage: its own circle
   * plus every settlement circle belonging to it. Empty until a city is chosen.
   *
   * ⛔ THE SELECTED Район NEVER APPEARS HERE, standalone or subdivision. That
   * narrowing is what made «Краснодар + п. Северный + хлебосольная» search a
   * 2.5 km circle 30 km outside Краснодар and answer «нет базы адресов» for a
   * real Krasnodar street `[measured]`.
   */
  scopeCircles: ServiceCircle[];
  /** The selected city's own circle, or undefined until a city is chosen. */
  cityCircle: ServiceCircle | undefined;
  /**
   * The selected Район's OWN circle, when it has one.
   *
   * ⛔ THIS IS NOT A SCOPE AND MUST NEVER BE USED AS A FILTER. Using it as one
   * is precisely the п. Северный bug. It has exactly two permitted uses:
   *   1. `center`/`zoom` below — where the map sits;
   *   2. an ADDITIONAL viewbox hint in `/geo/suggest`, which can only ADD rows
   *      to a city-wide result set, never remove any.
   * Use (2) exists because Nominatim ranks globally: `street=Красная` over
   * Краснодар's whole coverage returns 40 rows that are ALL in the city centre,
   * and ст. Динская's own Красная — 28 km out — never appears `[measured]`.
   * Sweeping the Район's box as well surfaces it; the city circles still decide
   * what is admissible, and distance from `center` decides the order.
   */
  focusCircle: ServiceCircle | undefined;
  /**
   * Where the map sits before a point is picked, AND the origin results are
   * ranked from.
   *
   * ⭐ THIS IS THE ONE THING THE Район STILL DRIVES, and deliberately so:
   * centring on «п. Северный» is useful orientation even though the search
   * covers all of Краснодар. Map centring, never search scope.
   */
  center: LatLng;
  zoom: number;
  /**
   * The selected Район's name — used ONLY for stripping a re-typed locality out
   * of the street field and for the hint under the input. ⛔ It must never
   * reach the geocoder as `city=` or inside `q=`.
   */
  locality: string;
  /** Every name that counts as "the locality" for redundancy-stripping. */
  aliases: string[];
  /** True when the chosen settlement is absent from OSM — no pin is possible. */
  unmapped: boolean;
};

/** Krasnodar Krai — used until a city is chosen. Never a world view. */
export const REGION_DEFAULT: LatLng = { lat: 45.0355, lng: 38.9753 };

/**
 * ⭐⭐ THE SEARCH SCOPE IS ALWAYS THE WHOLE SELECTED CITY. THE Район ONLY
 * MOVES THE MAP.
 *
 * ⚠ SUPERSEDES the 2026-08-31 "scope to the settlement that owns the street
 * data" rule, which split the Район selector into standalone settlements
 * (searched on their own) and city subdivisions (searched city-wide). That
 * split is technically accurate about OSM and WRONG for this product: the owner
 * of a Krasnodar flat picks the Район nearest to them and then types a street
 * that belongs to the city, and any per-Район narrowing deletes it.
 *
 * Measured failure it caused: «Краснодар + п. Северный + хлебосольная» → 0
 * results and «В населённом пункте "п. Северный" нет базы адресов», while
 * улица Хлебосольная (45.13151/38.98944) is a real Krasnodar street. The
 * dropdown's «п. Северный» is a hamlet at 44.82551/39.21296 — 29.9 km away
 * near Псекупс — and it is classified `standalone: true`, so the previous fix
 * left the narrowing switched on for it.
 *
 * The rule now: `scopeCircles` is the city's whole coverage for EVERY row
 * type; the Район's own circle survives only as `center`/`zoom`, i.e. where
 * the map sits. `ServiceCircle.standalone` is still generated and still
 * asserted by the backend sync test, but NOTHING in the search path may read
 * it — see `app/geo/suggest/route.ts`.
 */
export function resolveArea(areaName: string, cityName: string): ResolvedArea {
  const key = areaName ? settlementKey(areaName) : "";
  // The Район's own circle. ⚠ Used for the MAP ONLY — never for scope.
  const areaCircle = key ? circleFor(key) : undefined;
  const city = cityName ? cityCircle(cityName) : undefined;
  const noCircle = key && !areaCircle ? SETTLEMENTS_WITHOUT_CIRCLE[key] : undefined;
  const zoomFor = (r: number) => (r <= 3 ? 15 : r <= 5 ? 14 : 12);

  return {
    // ⛔ NOT `areaCircle`. Every row type scopes to the whole city.
    scopeCircles: circlesForCity(cityName),
    cityCircle: city,
    focusCircle: areaCircle,
    // Centre on the Район's OWN point when it has one; otherwise the city's.
    // Never REGION_DEFAULT once a city is selected.
    center: areaCircle ? areaCircle.center : city ? city.center : REGION_DEFAULT,
    zoom: areaCircle ? zoomFor(areaCircle.radiusKm) : city ? 12 : 9,
    locality: key || cityName,
    aliases: [key, cityName].filter(Boolean),
    unmapped: noCircle?.reason === "unmapped",
  };
}

/**
 * Drop a locality the user re-typed inside the street field.
 *
 * Real report: with Бетта already selected, the owner typed
 * «Садовая 3 хутор Бетта». Nominatim's structured `street=` is matched against
 * the street line alone, so the extra locality makes the query fail outright —
 * a duplicated fact turning into zero results.
 */
const LOCALITY_WORDS =
  "хутор|х\\.|станица|ст\\.|посёлок|поселок|пос\\.|п\\.|село|с\\.|аул|деревня|д\\.|мкр|микрорайон|пгт|город|г\\.";

export function stripRedundantLocality(query: string, aliases: string[]): string {
  let out = query;
  for (const raw of aliases) {
    const a = settlementKey(raw);
    if (!a) continue;
    // The stored name may itself carry a prefix ("ст. Елизаветинская"); match
    // on the bare part too, so both spellings are removed.
    const bare = a.replace(new RegExp(`^(?:${LOCALITY_WORDS})\\s+`, "iu"), "");
    for (const needle of new Set([a, bare])) {
      if (needle.length < 3) continue;
      const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // ⚠ NOT `\b`. JavaScript's word boundary is defined against \w, i.e.
      // [A-Za-z0-9_] — it does NOT know Cyrillic, so `\bБетта\b` matches
      // NOTHING and the whole strip silently no-ops. That is exactly why
      // «Садовая 3 хутор Бетта» still returned zero results after this
      // function was added `[measured]`. Unicode property escapes give a real
      // letter boundary.
      out = out.replace(
        new RegExp(
          `(?:(?:${LOCALITY_WORDS})\\s*)?(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`,
          "giu",
        ),
        " ",
      );
    }
  }
  return out.replace(/[\s,]+/gu, " ").replace(/^[\s,]+|[\s,]+$/gu, "").trim();
}
