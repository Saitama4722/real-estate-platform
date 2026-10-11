/**
 * THE shared address-autocomplete client for this project.
 *
 * ⚠ EVERY address input must use this module. Do not re-implement suggestion
 * fetching in a component — that is exactly how the previous integration ended
 * up living inline inside `CrmPropertyAddressMap.tsx`, invisible to the public
 * form and impossible to fix in one place. See the rule in CLAUDE.md.
 *
 * ── Provider ────────────────────────────────────────────────────────────────
 * Nominatim (OpenStreetMap), called through our own `/geo/*` route handlers.
 *
 * ⚠ This REPLACED 2GIS, which this project had previously chosen over Yandex.
 * Measured 2026-08-31: the stored 2GIS key returns
 * `403 {"message":"Authorization error, incorrect key."}` on BOTH
 * `catalog.api.2gis.com/3.0/suggests` and `/3.0/items/geocode`, with and
 * without a Referer — so it is the key that is rejected, not the origin. The
 * Yandex Geosuggest key still works but returns NO coordinates, and the Yandex
 * Geocoder key needed to resolve them answers `403 Invalid api key` — which is
 * why Yandex was not a usable substitute either. Nominatim is keyless and
 * returns coordinates directly. To go back to 2GIS, replace the two `/geo/*`
 * route handlers; nothing in the UI needs to change.
 *
 * ── Failure is a first-class outcome ────────────────────────────────────────
 * Every function RESOLVES with a discriminated result and never throws. A
 * geocoding outage must never block a lead: the owner types the address by hand
 * and submits without coordinates, which the API accepts by design.
 */

export type AddressSuggestion = {
  /** Short "улица, дом" — what goes into the input when picked. */
  label: string;
  /** Full address line, shown as the dropdown's secondary text. */
  detail: string;
  lat: number | null;
  lon: number | null;
  /** Which served city the point falls in — shown as a badge, because street
   *  names repeat between Краснодар and Геленджик. */
  city?: string;
};

export type SuggestOutcome =
  | { status: "ok"; items: AddressSuggestion[] }
  | { status: "empty" }
  /** Provider unreachable or erroring — the caller must stay usable. */
  | { status: "unavailable" };

export type ReverseOutcome =
  | { status: "ok"; label: string; detail: string }
  | { status: "unavailable" };

/** Below this many characters a query is noise; do not spend a request on it. */
export const SUGGEST_MIN_CHARS = 3;

/** Debounce for type-ahead. Nominatim asks for <= 1 req/s; 300ms plus the
 *  min-length gate keeps a fast typist comfortably under that. */
export const SUGGEST_DEBOUNCE_MS = 300;

export async function fetchAddressSuggestions(
  query: string,
  opts: { city?: string; district?: string; signal?: AbortSignal } = {},
): Promise<SuggestOutcome> {
  const q = query.trim();
  if (q.length < SUGGEST_MIN_CHARS) return { status: "empty" };

  const params = new URLSearchParams({ q });
  if (opts.city) params.set("city", opts.city);
  if (opts.district) params.set("district", opts.district);

  try {
    const res = await fetch(`/geo/suggest?${params.toString()}`, {
      signal: opts.signal,
    });
    if (!res.ok) return { status: "unavailable" };
    const data = (await res.json()) as { items?: AddressSuggestion[] };
    const items = Array.isArray(data.items) ? data.items : [];
    return items.length > 0 ? { status: "ok", items } : { status: "empty" };
  } catch (err) {
    // An aborted request is a superseded keystroke, not an outage — the caller
    // ignores it. Anything else is a real failure.
    if (err instanceof DOMException && err.name === "AbortError") {
      return { status: "empty" };
    }
    return { status: "unavailable" };
  }
}

export async function reverseGeocode(
  lat: number,
  lon: number,
  opts: { signal?: AbortSignal } = {},
): Promise<ReverseOutcome> {
  try {
    const res = await fetch(
      `/geo/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
      { signal: opts.signal },
    );
    if (!res.ok) return { status: "unavailable" };
    const data = (await res.json()) as { label?: string; detail?: string };
    if (!data.label) return { status: "unavailable" };
    return { status: "ok", label: data.label, detail: data.detail ?? "" };
  } catch {
    return { status: "unavailable" };
  }
}
