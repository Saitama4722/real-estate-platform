/**
 * Server-side fetch of the location dictionaries the catalog filter panel
 * needs (cities, districts, neighborhoods, commercial-type choices).
 *
 * Fetched ONCE on the server per request (revalidated) and passed down, so:
 *  - chips can label slugs («р-н Центральный», not «krd-centralnyj») in the
 *    server-rendered HTML, and
 *  - the client panel filters districts by city locally with no per-selection
 *    refetch (the full lists are dozens of rows).
 *
 * Same endpoints the SearchBar uses client-side; failures degrade to empty
 * lists — the panel still works, chips fall back to slugs.
 */

import { getPublicApiBaseUrl } from "@/lib/publicProperty";

export interface LocationCity {
  id: number;
  name: string;
  slug: string;
}

export interface LocationDistrict {
  id: number;
  name: string;
  slug: string;
  city: { id: number; name: string; slug: string } | null;
}

export interface LocationNeighborhood {
  id: number;
  name: string;
  slug: string;
  city: { id: number; name: string; slug: string } | null;
  district: { id: number; name: string; slug: string } | null;
}

export interface ChoiceEntry {
  value: string;
  label: string;
}

export interface CatalogLocationData {
  cities: LocationCity[];
  districts: LocationDistrict[];
  neighborhoods: LocationNeighborhood[];
  commercialTypes: ChoiceEntry[];
}

function rows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "results" in data) {
    const r = (data as { results?: unknown }).results;
    if (Array.isArray(r)) return r as T[];
  }
  return [];
}

async function fetchList<T>(url: string): Promise<T[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) {
      console.error("[fetchCatalogLocationData] HTTP", res.status, url);
      return [];
    }
    return rows<T>(await res.json());
  } catch (e) {
    console.error("[fetchCatalogLocationData]", url, e);
    return [];
  }
}

export async function fetchCatalogLocationData(): Promise<CatalogLocationData> {
  const base = getPublicApiBaseUrl();
  const [cities, districts, neighborhoods, choices] = await Promise.all([
    fetchList<LocationCity>(`${base}/locations/cities/`),
    fetchList<LocationDistrict>(`${base}/locations/districts/`),
    fetchList<LocationNeighborhood>(`${base}/locations/neighborhoods/`),
    (async () => {
      try {
        const res = await fetch(`${base}/locations/choices/`, {
          next: { revalidate: 300 },
        });
        if (!res.ok) return [];
        const data = (await res.json()) as { commercial_types?: ChoiceEntry[] };
        return Array.isArray(data?.commercial_types) ? data.commercial_types : [];
      } catch {
        return [];
      }
    })(),
  ]);
  return { cities, districts, neighborhoods, commercialTypes: choices };
}
