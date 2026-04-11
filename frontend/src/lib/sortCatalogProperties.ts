import type { CatalogPropertyItem } from "@/components/catalog/types";
import { parsePropertyListPriceRub } from "@/lib/similarProperties";

export function sortCatalogProperties(
  items: CatalogPropertyItem[],
  sort: string,
): CatalogPropertyItem[] {
  const copy = [...items];
  switch (sort) {
    case "price_asc":
      return copy.sort(
        (a, b) => parsePropertyListPriceRub(a.price) - parsePropertyListPriceRub(b.price),
      );
    case "price_desc":
      return copy.sort(
        (a, b) => parsePropertyListPriceRub(b.price) - parsePropertyListPriceRub(a.price),
      );
    case "area_desc":
      return copy.sort((a, b) => (b.area ?? 0) - (a.area ?? 0));
    case "new":
    default:
      return copy.sort((a, b) => {
        const da = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const db = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return db - da;
      });
  }
}
