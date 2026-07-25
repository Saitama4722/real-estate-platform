import { getPublicApiBaseUrl } from "@/lib/publicProperty";

/** Minimal location shapes for the public sell form pickers. */
export interface SellCity {
  id: number;
  name: string;
  slug: string;
}
export interface SellDistrict {
  id: number;
  name: string;
  slug: string;
  city_id: number;
}
export interface SellNeighborhood {
  id: number;
  name: string;
  slug: string;
  city: number | { id: number };
  district: number | { id: number } | null;
}

function toList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "results" in data) {
    const r = (data as { results?: unknown }).results;
    if (Array.isArray(r)) return r as T[];
  }
  return [];
}

export async function fetchSellCities(): Promise<SellCity[]> {
  try {
    const res = await fetch(`${getPublicApiBaseUrl()}/locations/cities/`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return toList<SellCity>(await res.json());
  } catch {
    return [];
  }
}
