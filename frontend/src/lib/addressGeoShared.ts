/**
 * Shared constants for the address-geocoding proxy routes.
 *
 * Server-only values live here so the route handlers agree on them; the client
 * module (`lib/addressSuggest.ts`) never imports this file.
 */

/** Nominatim (OpenStreetMap). Keyless, returns coordinates with each result. */
export const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

/**
 * Nominatim's usage policy REQUIRES a User-Agent identifying the application
 * and a way to reach its operator. Do not remove it and do not send a browser
 * UA — requests without one are liable to be blocked.
 *
 * The operator's contact address comes from NOMINATIM_CONTACT_EMAIL (server-side
 * env, deliberately NOT NEXT_PUBLIC_ — it must not be inlined into the client
 * bundle, and the repository is public). Read per call, at request time. When
 * it is unset the UA still identifies the app and its site, just without the
 * address — a missing variable must never break address search.
 */
export function geoContactUserAgent(): string {
  const contact = process.env.NOMINATIM_CONTACT_EMAIL?.trim();
  return contact
    ? `Centreal/1.0 (real-estate platform; +https://centreal.ru; contact: ${contact})`
    : "Centreal/1.0 (real-estate platform; +https://centreal.ru)";
}

export type GeoSuggestion = {
  /** Short "улица, дом" for the input value. */
  label: string;
  /** Full address for the dropdown's second line. */
  detail: string;
  lat: number | null;
  lon: number | null;
  /** Which of the two served cities this point falls in. Derived from the
   *  COORDINATES, not the query — street names repeat across both cities, so
   *  the dropdown has to say which one each result belongs to. */
  city?: string;
};
