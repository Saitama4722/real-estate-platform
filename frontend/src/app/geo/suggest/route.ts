import { NextResponse } from "next/server";

import {
  geoContactUserAgent,
  NOMINATIM_BASE,
  type GeoSuggestion,
} from "@/lib/addressGeoShared";
import {
  ALL_CIRCLES,
  circleForPoint,
  circlesForCity,
  distanceKm,
  isInsideCircle,
  resolveArea,
  stripRedundantLocality,
  viewboxForCircles,
  type LatLng,
  type ServiceCircle,
} from "@/components/address/addressMapConstants";

/**
 * Address suggestions for the public /sell form and the CRM property form.
 *
 * ⚠ WHY THIS IS A SERVER ROUTE AND NOT A BROWSER fetch().
 * Nominatim's usage policy requires a User-Agent identifying the application,
 * and a browser CANNOT set User-Agent from fetch() — it is a forbidden header.
 * Calling it straight from the client would be a policy violation AND a CORS
 * problem. Proxying also keeps the contact address out of the bundle and gives
 * one place to add caching or a rate limit later.
 *
 * ⚠ THE PATH IS /geo/... AND MUST NOT MOVE UNDER /api/.
 * `next.config.ts` rewrites `/api/:path*` to Django in `beforeFiles`, which runs
 * BEFORE filesystem routes — a handler at /api/geo/... would never be reached.
 *
 * ⭐⭐ THE SEARCH SCOPE IS THE WHOLE SELECTED CITY — ALWAYS. The Район narrows
 * NOTHING. `resolveArea(district, city).scopeCircles` is the city's own circle
 * plus every settlement circle belonging to it; the viewbox sent upstream is
 * the box circumscribing that whole set, and every result is re-checked against
 * the union of those circles afterwards. ⚠ The box is a HINT — it is ~55 km
 * across for Краснодар and does contain Усть-Лабинск, Абинск and Крымск. The
 * circles are the test, and dropping that re-filter would put those towns in
 * the dropdown.
 *
 * ⛔ THE Район'S NAME MUST NEVER REACH NOMINATIM — not as `city=`, not inside
 * `q=`, for ANY row type. Two measured bugs came from it:
 *   · «Геленджик + Центр + Ленина» → one street in ДИВНОМОРСКОЕ, 7.6 km away,
 *     because `q="Ленина, Центр"` matched something degenerate first;
 *   · «Краснодар + п. Северный + хлебосольная» → ZERO results for a real
 *     Krasnodar street, because the scope collapsed to a 2.5 km circle around a
 *     hamlet 30 km outside the city.
 * The first was fixed for subdivisions only; the second is the leftover that
 * fix left switched on for `standalone` rows. Both halves are now gone —
 * `standalone` is not read here at all, and it must stay that way.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ⚠ NOTHING ON THIS ROUTE MAY BE CACHED, AND "no cache header" IS NOT THE SAME
 * AS "not cached".
 *
 * `dynamic = "force-dynamic"` keeps it out of Next's Full Route Cache and
 * `cache: "no-store"` on the upstream call keeps it out of the Data Cache — but
 * before this constant the response carried NO `Cache-Control` at all
 * `[measured]`, leaving reuse in the browser to heuristics. An empty suggestion
 * list is the one response that must never be replayed: it is exactly what the
 * п. Северный bug produced, and a heuristically cached `{"items":[]}` would
 * outlive the fix on any browser that decided to keep it. Sent on EVERY
 * response, including the 502 outage branch, so a rate-limited moment cannot be
 * replayed as a permanent failure either.
 */
const NO_STORE = { "Cache-Control": "no-store" } as const;

type RawResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: Record<string, string>;
};

async function nominatim(params: URLSearchParams): Promise<RawResult[]> {
  const res = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
    headers: { "User-Agent": geoContactUserAgent(), Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  return (await res.json()) as RawResult[];
}

/**
 * ⚠ `limit` IS 40 (Nominatim's maximum), NOT 8, AND THAT IS NOT A TUNING KNOB.
 * The viewbox now spans a whole city's coverage instead of one settlement's
 * circle, so it necessarily contains unserved towns; the post-filter throws
 * their streets away. With `limit=8` a common name like «Красная» could fill
 * the entire upstream response with rows that all get filtered out, turning a
 * city-wide search into «ничего не найдено». Asking for 40 gives the filter
 * something to work with, and it is still ONE upstream request.
 */
function baseParams(viewbox: string): URLSearchParams {
  return new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "40",
    "accept-language": "ru",
    countrycodes: "ru",
    viewbox,
    // Hard-restrict to the box. ⚠ Not trusted on its own — see the filter below.
    bounded: "1",
  });
}

/**
 * A trailing house number, so it can be dropped and re-attached.
 *
 * ⚠ OSM HOUSE-NUMBER COVERAGE IN THESE TWO CITIES IS PATCHY, and a user must
 * never have to discover for themselves that deleting the number makes the
 * search work. Measured: Nominatim's structured `street=` usually degrades on
 * its own (`street=Красная 999` still returns Красная улица), so this is the
 * belt-and-braces path for the cases where it does not — notably the free-form
 * attempt, where a number that matches nothing kills the whole match.
 */
const HOUSE_TAIL = /[\s,]+(\d+[^\s,]*)$/u;

function splitHouseNumber(q: string): { street: string; house: string } | null {
  const m = HOUSE_TAIL.exec(q);
  if (!m) return null;
  const street = q.slice(0, m.index).trim();
  // "дом 5" alone is not a street; do not retry on a fragment.
  return street.length >= 3 ? { street, house: m[1] } : null;
}

type ScopeHit = {
  results: RawResult[];
  /**
   * The house number the USER typed, carried alongside the results so a label
   * can show it when OSM has no number of its own.
   *
   * ⚠ NOT only for the retry path. Nominatim frequently answers a numbered
   * query with the bare STREET (`Революционная 8` → «Революционная улица», no
   * number `[measured]`), and without this the number the user typed would
   * silently disappear from the suggestion they pick.
   */
  house: string | null;
};

/**
 * One city's search scope: the circles a result must land in, the viewbox hint
 * that covers them, and the point results are ranked from.
 */
type Scope = {
  /** ⭐ The city's WHOLE coverage — its circle plus every settlement's. */
  circles: ServiceCircle[];
  /**
   * Viewbox hints, swept in order and UNIONED. `[0]` is the box circumscribing
   * the whole city's coverage. `[1]`, present only when a Район with its own
   * circle is selected, is that Район's box.
   *
   * ⚠ THE SECOND BOX IS ADDITIVE AND CANNOT NARROW ANYTHING — its rows are
   * appended to the first sweep's and then judged by the SAME city-wide circle
   * filter. It exists because Nominatim ranks globally and a 40-row cap is a
   * real constraint: `street=Красная` across all of Краснодар's coverage comes
   * back as 40 city-centre streets, and ст. Динская's own Красная is nowhere in
   * it `[measured]`. Without this sweep, "search the whole city" would be true
   * of the QUERY and false of the RESULTS.
   *
   * ⛔ Do not "simplify" this by scoping the query to box `[1]`. That is the
   * п. Северный bug, re-spelled.
   */
  viewboxes: string[];
  /**
   * ⭐ RANKING ORIGIN — the selected Район's centre when one is chosen, else the
   * city's. This is the ONLY thing the Район is allowed to influence, and it
   * changes the ORDER of the results, never the SET.
   */
  origin: LatLng;
};

/**
 * ⛔ ONE QUERY SHAPE, NO LOCALITY NARROWING. `street=<what the user typed>`
 * inside the city-wide viewbox, and nothing else.
 *
 * The `city=<settlement>` and `q="<street>, <settlement>"` attempts that used to
 * precede this are DELETED, not merely skipped, so no future flag can switch
 * them back on. They existed to help thinly-mapped хутора and they cost more
 * than they gave: this loop returns at the FIRST attempt that yields anything,
 * so a loose match inside a village short-circuited the correct city-wide
 * search — «Геленджик + Центр + Ленина» returned exactly one street, in
 * Дивноморское `[measured]`. A settlement's own streets are still reachable,
 * because the viewbox and the filter now span the whole city, and they sort
 * first when that settlement is the selected Район.
 *
 * Cost: ONE upstream request, or two when a house number has to be retried
 * without its number. That is down from up to six, which is direct relief on
 * the rate limit.
 */
async function queryScope(q: string, scope: Scope): Promise<ScopeHit> {
  const split = splitHouseNumber(q);
  const house = split?.house ?? null;

  /**
   * The same street query against every viewbox, UNIONED.
   *
   * ⚠ SEQUENTIAL ON PURPOSE — Nominatim's policy is <= 1 request/second, and
   * firing the boxes concurrently is a burst that invites the 429 this project
   * has already shipped to users once.
   *
   * ⚠ A BOX THAT FAILS IS NOT A BOX THAT FOUND NOTHING. If at least one sweep
   * completed a round-trip the answer is real, merely possibly thinner; only
   * when EVERY sweep failed do we rethrow, so the caller can report an outage
   * instead of «улица не найдена». Same rule as the per-scope catch, one level
   * down.
   */
  const sweep = async (street: string): Promise<RawResult[]> => {
    const out: RawResult[] = [];
    let anyOk = false;
    let lastError: unknown = null;
    for (const viewbox of scope.viewboxes) {
      const p = baseParams(viewbox);
      p.set("street", street);
      try {
        out.push(...(await nominatim(p)));
        anyOk = true;
      } catch (err) {
        lastError = err;
      }
    }
    if (!anyOk) throw lastError ?? new Error("no viewbox queried");
    return out;
  };

  const first = await sweep(q);
  if (first.length > 0) return { results: first, house };

  // Nothing matched the full text. If it ended in a house number, the street
  // itself may still be known — give the user the street rather than nothing.
  if (split) {
    const retry = await sweep(split.street);
    if (retry.length > 0) return { results: retry, house };
  }
  return { results: [], house: null };
}

function toSuggestion(r: RawResult, house: string | null): GeoSuggestion | null {
  const lat = Number.parseFloat(r.lat ?? "");
  const lon = Number.parseFloat(r.lon ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  // ⚠ FILTER, DO NOT TRUST `bounded=1`. Nominatim honours it as a strong hint,
  // not a guarantee. Anything outside every service circle is discarded.
  const owning = circleForPoint(lat, lon);
  if (!owning) return null;
  const owner = owning.city;

  const a = r.address ?? {};
  const road = a.road ?? a.pedestrian ?? a.residential ?? "";
  // OSM's own number when it has one; otherwise the number the user typed, put
  // back after the street-only retry — the coordinate is the street's, but the
  // address they meant is still theirs and must not silently vanish.
  const houseNumber = a.house_number ?? house ?? "";
  const short = [road, houseNumber].filter(Boolean).join(", ");
  const label =
    short || (r.display_name ?? "").split(",").slice(0, 2).join(",").trim();
  if (!label) return null;

  /**
   * ⭐ WHICH SETTLEMENT THIS STREET IS IN — now REQUIRED, not decorative.
   *
   * Search covers the whole city, so «Красная улица» comes back from Краснодар
   * itself AND from ст. Динская AND from ст. Васюринская in one list. Without
   * this the rows are indistinguishable and the owner cannot pick correctly.
   *
   * ⚠ FALL BACK TO OUR OWN CIRCLE'S NAME when OSM names no place. OSM omits
   * `village`/`suburb` on plenty of ways, and a bare «Краснодар» badge on a
   * street that is actually in х. Ленина is worse than no badge — it is wrong.
   * `owning` is the nearest circle CONTAINING the point, so its name is a
   * measured statement about where the coordinate is.
   */
  const osmPlace =
    a.village ?? a.hamlet ?? a.town ?? a.suburb ?? a.city_district ?? "";
  const place = osmPlace || (owning.kind !== "city" ? owning.name : "");

  return {
    label,
    detail: r.display_name ?? "",
    lat,
    lon,
    // Derived from the COORDINATES, not the query, so it is right even if
    // Nominatim answers from somewhere else entirely.
    city: place && place !== owner ? `${place}, ${owner}` : owner,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQ = (searchParams.get("q") ?? "").trim();
  const city = (searchParams.get("city") ?? "").trim();
  const district = (searchParams.get("district") ?? "").trim();

  const area = resolveArea(district, city);

  // «Садовая 3 хутор Бетта» with Бетта already selected -> «Садовая 3».
  // ⚠ This is the ONLY remaining use of the Район's name, and it only REMOVES
  // text the user duplicated. It never reaches Nominatim as a place filter.
  const q = stripRedundantLocality(rawQ, area.aliases) || rawQ;

  if (q.length < 3) {
    return NextResponse.json({ items: [] as GeoSuggestion[] }, { headers: NO_STORE });
  }

  /**
   * ⭐⭐ ONE SCOPE PER CITY — AND THE SCOPE IS THE WHOLE CITY.
   *
   * With a city chosen there is exactly one scope: all of its circles, ranked
   * from the selected Район's centre. With nothing chosen we fall back to BOTH
   * cities' full scopes and interleave them, because the Район field is
   * disabled until a city is picked anyway.
   *
   * ⛔ `area.scopeCircles` never contains the Район's circle alone. If you find
   * yourself building a scope from `circleFor(district)`, you are reintroducing
   * the п. Северный bug.
   */
  const scopes: Scope[] =
    area.scopeCircles.length > 0
      ? [
          {
            circles: area.scopeCircles,
            viewboxes: [
              viewboxForCircles(area.scopeCircles),
              // Additive only — see Scope.viewboxes. Absent when the Район has
              // no circle of its own (the 18 coordinate-less microdistricts),
              // which need it least: they sit inside the city box already.
              ...(area.focusCircle
                ? [viewboxForCircles([area.focusCircle])]
                : []),
            ],
            origin: area.center,
          },
        ]
      : ALL_CIRCLES.filter((c) => c.kind === "city").map((cityCircle) => {
          const circles = circlesForCity(cityCircle.city);
          return {
            circles,
            viewboxes: [viewboxForCircles(circles)],
            origin: cityCircle.center,
          };
        });

  // ⚠ AN UPSTREAM FAILURE IS NOT "NOTHING FOUND". Tracked per scope so a
  // rate-limited or unreachable Nominatim can be reported as an outage instead
  // of being rendered to the user as «Ничего не найдено».
  let anySucceeded = false;

  try {
    const batches = await Promise.all(
      scopes.map(async (scope) => {
        try {
          const { results, house } = await queryScope(q, scope);
          anySucceeded = true;
          return results
            .map((r) => toSuggestion(r, house))
            .filter((x): x is GeoSuggestion => x !== null)
            // ⭐ THE CIRCLES ARE AUTHORITATIVE. The viewbox above circumscribes
            // the whole city's coverage, so its corners reach well past it —
            // this is what trims Усть-Лабинск, Абинск and Крымск back out.
            .filter((x) =>
              scope.circles.some((c) => isInsideCircle(x.lat!, x.lon!, c)),
            )
            /**
             * ⭐ ORDERED BY DISTANCE FROM THE SELECTED Район'S CENTRE (the
             * city's when no Район is chosen).
             *
             * This is what makes a city-wide result set usable: with
             * «Краснодар + ст. Динская + Красная» the owner now gets every
             * Красная in the округ, and Динская's own — the one they meant —
             * sorts first at ~0 km while the city's sits ~28 km down the list.
             * ⚠ Ranking, NOT filtering: a far-away match is demoted, never
             * dropped. That distinction is the whole point of this change.
             */
            .sort(
              (x, y) =>
                distanceKm({ lat: x.lat!, lng: x.lon! }, scope.origin) -
                distanceKm({ lat: y.lat!, lng: y.lon! }, scope.origin),
            );
        } catch {
          // One scope failing must not lose the other's results.
          return [] as GeoSuggestion[];
        }
      }),
    );

    // Every scope failed upstream — say so, rather than claiming the street
    // does not exist. The UI has a distinct, honest message for this.
    if (!anySucceeded) {
      return NextResponse.json(
        { items: [], error: "unavailable" },
        { status: 502, headers: NO_STORE },
      );
    }

    // Interleave so neither city monopolises a short list.
    const merged: GeoSuggestion[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < Math.max(...batches.map((b) => b.length), 0); i += 1) {
      for (const b of batches) {
        const item = b[i];
        if (!item) continue;
        const key = `${item.city}|${item.label}|${item.lat}|${item.lon}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
      }
    }

    return NextResponse.json({ items: merged.slice(0, 10) }, { headers: NO_STORE });
  } catch {
    return NextResponse.json(
      { items: [], error: "unavailable" },
      { status: 502, headers: NO_STORE },
    );
  }
}
