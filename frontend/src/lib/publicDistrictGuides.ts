import { getPublicApiBaseUrl } from "@/lib/publicProperty";

/** City shape nested in a guide (mirrors the backend CityShortSerializer). */
export interface GuideCity {
  id: number;
  name: string;
  slug: string;
}

export interface PublicDistrictGuide {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  coverImage: string | null;
  city: GuideCity | null;
  /** Catalog query param this guide's area maps to: "district_slug" | "neighborhood_slug". */
  catalogParam: string;
  /** The slug value to pass to that catalog param. */
  catalogSlug: string;
}

export interface PublicDistrictGuideDetail extends PublicDistrictGuide {
  body: string;
}

interface GuideRaw {
  slug: string;
  title: string;
  excerpt: string;
  published_at: string;
  cover_image: string | null;
  city: GuideCity | null;
  catalog_param: string;
  catalog_slug: string;
  body?: string;
}

function mapGuide(row: GuideRaw): PublicDistrictGuideDetail {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    publishedAt: row.published_at,
    coverImage: row.cover_image,
    city: row.city,
    catalogParam: row.catalog_param,
    catalogSlug: row.catalog_slug,
    body: row.body ?? "",
  };
}

function normalizeList(data: unknown): GuideRaw[] {
  if (Array.isArray(data)) return data as GuideRaw[];
  if (data && typeof data === "object" && "results" in data) {
    const r = (data as { results?: unknown }).results;
    if (Array.isArray(r)) return r as GuideRaw[];
  }
  return [];
}

export async function fetchPublicDistrictGuidesList(): Promise<PublicDistrictGuide[]> {
  const url = `${getPublicApiBaseUrl()}/locations/district-guides/`;
  try {
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (!res.ok) {
      console.error("[fetchPublicDistrictGuidesList] HTTP", res.status, url);
      return [];
    }
    return normalizeList(await res.json()).map(mapGuide);
  } catch (e) {
    console.error("[fetchPublicDistrictGuidesList]", url, e);
    return [];
  }
}

export async function fetchPublicDistrictGuideBySlug(
  slug: string,
): Promise<PublicDistrictGuideDetail | null> {
  const enc = encodeURIComponent(slug.trim());
  const url = `${getPublicApiBaseUrl()}/locations/district-guides/${enc}/`;
  try {
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error("[fetchPublicDistrictGuideBySlug] HTTP", res.status, url);
      return null;
    }
    return mapGuide((await res.json()) as GuideRaw);
  } catch (e) {
    console.error("[fetchPublicDistrictGuideBySlug]", url, e);
    return null;
  }
}

/**
 * Build the catalog URL that pre-filters listings for a guide's area.
 * Reuses the EXACT existing filter params (district_slug / neighborhood_slug)
 * from the DistrictCombobox work — the backend already tells us which one via
 * catalogParam, so we never guess. city_slug is added when known to keep the
 * filter scoped to the right city.
 */
export function buildGuideCatalogHref(guide: PublicDistrictGuide): string {
  const q = new URLSearchParams();
  q.set(guide.catalogParam, guide.catalogSlug);
  if (guide.city?.slug) q.set("city_slug", guide.city.slug);
  return `/catalog?${q.toString()}`;
}

/** Group guides by city, preserving the API's publish-ordered sequence within each. */
export function groupGuidesByCity(
  guides: PublicDistrictGuide[],
): { city: GuideCity; guides: PublicDistrictGuide[] }[] {
  const order: string[] = [];
  const map = new Map<string, { city: GuideCity; guides: PublicDistrictGuide[] }>();
  for (const g of guides) {
    if (!g.city) continue;
    const key = g.city.slug;
    if (!map.has(key)) {
      map.set(key, { city: g.city, guides: [] });
      order.push(key);
    }
    map.get(key)!.guides.push(g);
  }
  return order.map((k) => map.get(k)!);
}
