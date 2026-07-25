import type { CatalogPropertyItem } from "@/components/catalog/types";

export function parsePropertyListPriceRub(price: string): number {
  return parseInt(price.replace(/\D/g, ""), 10) || 0;
}

/**
 * Rank "similar" properties for a detail page.
 *
 * Property type is a HARD filter — a house is never "similar" to an apartment,
 * so different-type listings are excluded outright rather than scored down. The
 * current property is excluded. Within the same-type pool we rank by locality
 * (district → neighborhood), then price closeness, with rooms/area as gentle
 * tie-breakers, and return the top `max`.
 *
 * (Publication/visibility filtering happens upstream in the fetch — the pool
 * comes from the public list endpoint, which only returns published listings.)
 */
export function getSimilarProperties(
  current: CatalogPropertyItem,
  pool: CatalogPropertyItem[],
  max = 4,
): CatalogPropertyItem[] {
  const currentPrice = parsePropertyListPriceRub(current.price);

  const scored = pool
    // HARD filters: exclude self and any different property type.
    .filter(
      (p) =>
        p.id !== current.id &&
        !!p.propertyType &&
        p.propertyType === current.propertyType,
    )
    .map((p) => {
      let score = 0;

      // Locality (strongest remaining signal after type). Prefer slug matches;
      // fall back to the human-readable district name if slugs are absent.
      if (
        (current.districtSlug && p.districtSlug === current.districtSlug) ||
        (current.district && p.district === current.district)
      ) {
        score += 3;
      }
      if (
        current.neighborhoodSlug &&
        p.neighborhoodSlug === current.neighborhoodSlug
      ) {
        score += 2;
      }
      if (current.citySlug && p.citySlug === current.citySlug) {
        score += 1;
      }

      // Price proximity: within 15% is a strong match, within 30% a soft one.
      const priceDiff =
        currentPrice > 0
          ? Math.abs(parsePropertyListPriceRub(p.price) - currentPrice) /
            currentPrice
          : Number.POSITIVE_INFINITY;
      if (priceDiff <= 0.15) score += 2;
      else if (priceDiff <= 0.3) score += 1;

      // Gentle tie-breakers where the data exists.
      if (
        current.rooms != null &&
        p.rooms != null &&
        p.rooms === current.rooms
      ) {
        score += 1;
      }

      return { item: p, score, priceDiff };
    })
    // Highest score first; break ties by closest price.
    .sort((a, b) => b.score - a.score || a.priceDiff - b.priceDiff);

  return scored.slice(0, max).map((r) => r.item);
}
