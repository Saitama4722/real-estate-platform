import type { BreadcrumbItem } from "@/components/layout/breadcrumbs";
import type { CatalogPropertyItem } from "@/components/catalog/types";
import { siteOrigin } from "@/lib/articleSeo";

/**
 * Breadcrumb trail for a property detail page:
 *   Главная > Каталог > <Тип> > <Город> > <Название объекта>
 *
 * Type/city links prefer the site's SEO-canonical landing routes
 * (`/<city>/kupit-kvartiru`), which is exactly what the homepage «Популярные
 * запросы» links use and matches the rest of the site. When the property's city
 * isn't a known landing city (or type is missing), we fall back to the catalog
 * search page with the SAME query params the search form emits
 * (`property_type`, `city_slug`) so the filter still hydrates. Levels with no
 * usable data are simply omitted rather than shown as dead links.
 */

type PropertyType = NonNullable<CatalogPropertyItem["propertyType"]>;

/** Plural category label (breadcrumb segment) + its SEO landing URL segment. */
const TYPE_META: Record<PropertyType, { label: string; segment: string }> = {
  apartment: { label: "Квартиры", segment: "kupit-kvartiru" },
  house: { label: "Дома", segment: "kupit-dom" },
  land: { label: "Участки", segment: "kupit-uchastok" },
  commercial: { label: "Коммерция", segment: "kupit-kommercheskuyu-nedvizhimost" },
};

/** Cities that have SEO landing pages (`/<slug>/...`). */
const LANDING_CITY_NAME: Record<string, string> = {
  krasnodar: "Краснодар",
  gelendzhik: "Геленджик",
};

function catalogQueryHref(params: Record<string, string>): string {
  const q = new URLSearchParams(params);
  return `/catalog?${q.toString()}`;
}

/**
 * Build the visual breadcrumb items for a property detail page.
 * The final item (property title) is intentionally link-less (current page).
 */
export function buildPropertyBreadcrumbs(
  property: CatalogPropertyItem,
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { label: "Главная", href: "/" },
    { label: "Каталог", href: "/catalog" },
  ];

  const type = property.propertyType;
  const citySlug = property.citySlug;
  const isLandingCity = !!citySlug && citySlug in LANDING_CITY_NAME;

  // ── Тип (e.g. «Квартиры») ──
  if (type) {
    const meta = TYPE_META[type];
    // Type level is the BROADEST filter — this type across ALL cities. It must
    // link to the type-only catalog query, NOT the combined city+type landing
    // route, so it stays strictly distinct from (and broader than) the city
    // level below. The city level is what narrows to city+type.
    const href = catalogQueryHref({ property_type: type });
    items.push({ label: meta.label, href });
  }

  // ── Город (e.g. «Краснодар») ──
  if (citySlug) {
    const cityName = LANDING_CITY_NAME[citySlug];
    if (cityName) {
      // City level narrows type+city. If we have a type, the canonical landing
      // route already carries both, so reuse it; else catalog query with both.
      const href =
        type && isLandingCity
          ? `/${citySlug}/${TYPE_META[type].segment}`
          : catalogQueryHref(
              type
                ? { property_type: type, city_slug: citySlug }
                : { city_slug: citySlug },
            );
      items.push({ label: cityName, href });
    }
  }

  // ── Текущая страница (без ссылки) ──
  items.push({ label: property.title });

  return items;
}

/**
 * BreadcrumbList JSON-LD (schema.org). Only items WITH an href get an absolute
 * `item` URL; the last (current) item is included by position but without a URL,
 * which is valid and recommended for the current page.
 */
export function buildBreadcrumbJsonLd(
  items: BreadcrumbItem[],
): Record<string, unknown> {
  const origin = siteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => {
      const entry: Record<string, unknown> = {
        "@type": "ListItem",
        position: index + 1,
        name: item.label,
      };
      if (item.href) {
        // Absolute URL required by schema.org; strip query for cleanliness only
        // when it's a bare path — keep query params (they identify the filter).
        entry.item = item.href.startsWith("http")
          ? item.href
          : `${origin}${item.href}`;
      }
      return entry;
    }),
  };
}
