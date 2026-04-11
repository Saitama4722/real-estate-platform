import { unstable_cache } from "next/cache";
import type { CatalogPropertyItem } from "@/components/catalog/types";
import { fetchPublicPropertiesList } from "@/lib/publicPropertyList";
import {
  buildLandingH1,
  buildLandingInternalLinks,
  buildLandingSeoText,
  buildLandingSubtitle,
  filterPropertiesForLanding,
  resolveCatalogSegment,
  type CitySlug,
  type LandingResolved,
} from "@/lib/catalogSeoLanding";

export type CachedCatalogLandingModel = {
  resolved: LandingResolved;
  filtered: CatalogPropertyItem[];
  seoText: string;
  seoLinks: { label: string; href: string }[];
  h1: string;
  subtitle: string;
};

async function computeLandingModel(
  city: CitySlug,
  catalogSegment: string,
): Promise<CachedCatalogLandingModel | null> {
  const resolved = resolveCatalogSegment(city, catalogSegment);
  if (!resolved) return null;
  const all = await fetchPublicPropertiesList();
  return {
    resolved,
    filtered: filterPropertiesForLanding(all, city, resolved),
    seoText: buildLandingSeoText(city, catalogSegment),
    seoLinks: buildLandingInternalLinks(city, catalogSegment, resolved),
    h1: buildLandingH1(city, resolved),
    subtitle: buildLandingSubtitle(city, resolved),
  };
}

const loadCatalogLandingModel = unstable_cache(
  async (city: CitySlug, catalogSegment: string) =>
    computeLandingModel(city, catalogSegment),
  ["catalog-seo-landing"],
  { revalidate: 300 },
);

/**
 * Детерминированные данные SEO-посадочной страницы каталога (без персонализации).
 * Кэш снижает повторную работу при совпадении city+segment между запросами.
 */
export async function getCachedCatalogLandingModel(
  city: CitySlug,
  catalogSegment: string,
): Promise<CachedCatalogLandingModel | null> {
  return loadCatalogLandingModel(city, catalogSegment);
}
