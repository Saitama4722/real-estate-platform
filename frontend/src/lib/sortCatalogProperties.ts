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
      /*
       * «Сначала новые» means PUBLICATION order — the same field the API's
       * `-published_at` ordering and the «Новый объект» badge derive from.
       * Sorting by updatedAt here silently overrode the API's ordering and
       * let any CRM edit (a price fix, a typo) bump a months-old listing to
       * the top (review finding 4). updatedAt remains only as a fallback for
       * cached payloads that predate the published_at field.
       */
      return copy.sort((a, b) => {
        const ta = a.publishedAt ?? a.updatedAt;
        const tb = b.publishedAt ?? b.updatedAt;
        const da = ta ? new Date(ta).getTime() : 0;
        const db = tb ? new Date(tb).getTime() : 0;
        return db - da;
      });
  }
}
