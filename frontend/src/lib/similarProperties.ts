import type { CatalogPropertyItem } from "@/components/catalog/types";

export function parsePropertyListPriceRub(price: string): number {
  return parseInt(price.replace(/\D/g, ""), 10) || 0;
}

export function getSimilarProperties(
  current: CatalogPropertyItem,
  pool: CatalogPropertyItem[],
  max = 8,
): CatalogPropertyItem[] {
  const currentPrice = parsePropertyListPriceRub(current.price);

  return pool
    .filter((p) => p.id !== current.id)
    .map((p) => {
      let score = 0;
      if (p.propertyType && p.propertyType === current.propertyType) score += 2;
      if (p.district && p.district === current.district) score += 1;
      if (currentPrice > 0) {
        const diff =
          Math.abs(parsePropertyListPriceRub(p.price) - currentPrice) / currentPrice;
        if (diff < 0.3) score += 1;
      }
      return {
        item: p,
        score,
        priceDiff: Math.abs(parsePropertyListPriceRub(p.price) - currentPrice),
      };
    })
    .sort((a, b) => b.score - a.score || a.priceDiff - b.priceDiff)
    .slice(0, max)
    .map((r) => r.item);
}
