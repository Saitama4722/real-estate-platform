export type CatalogCitySlug = "krasnodar" | "gelendzhik";

export interface CatalogPropertyItem {
  id: number;
  /** Публичный URL-segment; ссылки в каталоге ведут на /catalog/[slug] */
  slug?: string;
  /** Город для SEO-каталога и фильтрации (/[city]/...) */
  citySlug?: CatalogCitySlug;
  /** Латинский slug района (в SEO URL: …/kupit-kvartiru-rajon-<slug>) */
  districtSlug?: string;
  /** Микрорайон (подпись в карточке при необходимости) */
  neighborhood?: string;
  /** Латинский slug микрорайона (в SEO URL: …/kupit-kvartiru-mikrorajon-<slug>) */
  neighborhoodSlug?: string;
  /** Латинский slug ЖК (сегмент после zhk-) */
  residentialComplexSlug?: string;
  image: string;
  price: string;
  title: string;
  characteristics: string;
  location: string;
  href: string;
  latitude: number;
  longitude: number;
  updatedAt?: string;
  gallery?: string[];
  videoUrl?: string;
  propertyType?: "apartment" | "house" | "land" | "commercial";
  rooms?: number;
  area?: number;
  floor?: number;
  totalFloors?: number;
  district?: string;
  description?: string;
  realtorName?: string;
  realtorAvatar?: string;
  /** Chronological price points (ascending). Numbers, ready for the chart. */
  priceHistory?: { price: number; changedAt: string }[];
  /** Current price is below the peak recorded price. */
  isPriceReduced?: boolean;
  /**
   * Realtor-entered previous price, as a raw number (format at the render site
   * with `formatPriceRub`). MANUAL, UNVERIFIED input — it is not derived from
   * price history and can contradict `isPriceReduced`, so never render it as a
   * struck-through price on its own. See PropertyCard for the display rule.
   */
  oldPrice?: number;
  /** Published within NEW_LISTING_WINDOW_DAYS (backend constant, currently 14). */
  isNew?: boolean;
  /** Публичный CRM ID риэлтора (RID######) для ссылки на страницу /realtors/... */
  realtorCrmId?: string;
  details?: {
    ceilingHeight?: string;
    kitchenArea?: string;
    balcony?: string;
    renovation?: string;
    plotArea?: string;
    houseFloors?: number;
    material?: string;
    sauna?: boolean;
    garage?: boolean;
    purpose?: string;
    roadAccess?: string;
    communications?: string;
    entrance?: string;
    line?: string;
    parking?: boolean;
  };
}
