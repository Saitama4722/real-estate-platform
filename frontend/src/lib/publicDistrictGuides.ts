import type { ArticleCardData } from "@/components/articles/ArticleCard";
import { readingTimeFromWordCount } from "@/lib/articleContent";
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
  /**
   * Whitespace-token count of everything the page renders, sent because the
   * LIST payload carries no section texts. Reading time is derived from it
   * HERE, in TypeScript — the backend never computes minutes (see
   * articleContent.ts).
   */
  wordCount: number;
}

/**
 * The five authored sections. «Что за район» renders WITHOUT a heading (the H1
 * already names the area), which is also why the 24 migrated guides — whose
 * whole text landed in `intro` — look exactly as they did before.
 */
export interface PublicDistrictGuideDetail extends PublicDistrictGuide {
  intro: string;
  housing: string;
  infrastructure: string;
  audience: string;
  conclusion: string;
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
  word_count?: number;
  intro?: string;
  housing?: string;
  infrastructure?: string;
  audience?: string;
  conclusion?: string;
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
    // 0 only for a stale cached payload predating the field; readingTime's
    // min-1 floor keeps that from rendering «0 мин».
    wordCount: row.word_count ?? 0,
    intro: row.intro ?? "",
    housing: row.housing ?? "",
    infrastructure: row.infrastructure ?? "",
    audience: row.audience ?? "",
    conclusion: row.conclusion ?? "",
  };
}

/**
 * Guide sections in reading order, with the headings the page prints.
 *
 * ⚠ These labels must stay identical to the Django field verbose_names — the
 * backend counts them into `word_count` via `rendered_text_parts()`, so a
 * mismatch would make the index card's clock disagree with the page's.
 */
export function guideSections(guide: PublicDistrictGuideDetail) {
  return [
    { heading: null, text: guide.intro },
    { heading: "Застройка и жильё", text: guide.housing },
    { heading: "Инфраструктура и транспорт", text: guide.infrastructure },
    { heading: "Кому подойдёт", text: guide.audience },
  ];
}

export function guideTakeaway(guide: PublicDistrictGuideDetail) {
  return { title: "Вывод", text: guide.conclusion };
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

/**
 * Project a guide onto the SHARED editorial card shape (components/articles/
 * ArticleCard). District guides and articles are the same kind of object to a
 * reader — a titled, dated, excerpted piece of writing — so /districts uses
 * that card rather than a look-alike of its own.
 *
 * Two fields differ from an article and both travel as data, not as a second
 * component:
 *  - `eyebrow` is the AREA KIND («Район» / «Микрорайон»), derived from the
 *    catalogParam the backend already sends. Not the city: /districts groups
 *    by city under a heading, so a city eyebrow would repeat it on every card,
 *    while the kind genuinely distinguishes neighbours in the same group.
 *  - `minutes` is derived from the serializer's `word_count`, not from the
 *    body (the list payload has none). The RULE lives in articleContent.ts,
 *    so the guide index and the article index cannot disagree about what a
 *    minute of reading is.
 */
export function districtGuideCardDataFrom(
  guide: PublicDistrictGuide,
): ArticleCardData {
  return {
    slug: guide.slug,
    href: `/districts/${guide.slug}`,
    title: guide.title,
    excerpt: guide.excerpt,
    eyebrow:
      guide.catalogParam === "neighborhood_slug" ? "Микрорайон" : "Район",
    publishedAt: guide.publishedAt,
    minutes: readingTimeFromWordCount(guide.wordCount),
    ctaLabel: "Читать гид",
  };
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
