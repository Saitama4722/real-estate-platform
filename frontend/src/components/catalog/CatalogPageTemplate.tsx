import Link from "next/link";
import { SearchBar } from "@/components/home/SearchBar";
import { Container } from "@/components/layout/container";
import { BreadcrumbItem, Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeading } from "@/components/layout/page-heading";
import { CatalogResultsSection } from "@/components/catalog/CatalogResultsSection";
import { CatalogPropertyItem } from "@/components/catalog/types";
import type { CatalogPageSearchRecord } from "@/lib/catalogQueryParams";
import {
  catalogSearchBarRemountKey,
  catalogSearchParamFirst,
} from "@/lib/catalogQueryParams";

interface CatalogSeoLink {
  label: string;
  href: string;
}

interface CatalogPageTemplateProps {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  subtitle?: string;
  properties: CatalogPropertyItem[];
  seoText: string;
  seoLinks: CatalogSeoLink[];
  /** Query каталога (для строки поиска); на SEO-посадочных обычно пустой объект. */
  catalogSearchParams?: CatalogPageSearchRecord;
  initialMapView?: boolean;
}

export function CatalogPageTemplate({
  breadcrumbs,
  title,
  subtitle,
  properties,
  seoText,
  seoLinks,
  catalogSearchParams,
  initialMapView,
}: CatalogPageTemplateProps) {
  const sp = catalogSearchParams ?? {};
  return (
    <div className="py-6 md:py-8">
      <Container>
        <Breadcrumbs items={breadcrumbs} />
        <PageHeading title={title} subtitle={subtitle} />

        <section aria-label="Фильтры каталога">
          <SearchBar
            key={catalogSearchBarRemountKey(sp)}
            variant="catalog"
            initialPropertyType={catalogSearchParamFirst(sp, "property_type")}
            initialCitySlug={catalogSearchParamFirst(sp, "city_slug")}
            initialDistrictSlug={catalogSearchParamFirst(sp, "district_slug")}
            initialRooms={catalogSearchParamFirst(sp, "rooms") ?? ""}
            initialRoomsMin={catalogSearchParamFirst(sp, "rooms_min") ?? ""}
            initialSearch={catalogSearchParamFirst(sp, "search") ?? ""}
            initialMarketType={catalogSearchParamFirst(sp, "market_type") ?? ""}
            initialPriceMin={catalogSearchParamFirst(sp, "price_min") ?? ""}
            initialPriceMax={catalogSearchParamFirst(sp, "price_max") ?? ""}
            initialHouseAreaMin={catalogSearchParamFirst(sp, "house_area_min") ?? ""}
            initialHouseAreaMax={catalogSearchParamFirst(sp, "house_area_max") ?? ""}
            initialHouseLandAreaMin={catalogSearchParamFirst(sp, "house_land_area_min") ?? ""}
            initialHouseLandAreaMax={catalogSearchParamFirst(sp, "house_land_area_max") ?? ""}
            initialLandAreaMin={catalogSearchParamFirst(sp, "land_area_min") ?? ""}
            initialLandAreaMax={catalogSearchParamFirst(sp, "land_area_max") ?? ""}
            initialCommercialType={catalogSearchParamFirst(sp, "commercial_type") ?? ""}
            initialCommercialAreaMin={catalogSearchParamFirst(sp, "commercial_area_min") ?? ""}
            initialCommercialAreaMax={catalogSearchParamFirst(sp, "commercial_area_max") ?? ""}
          />
        </section>

        <CatalogResultsSection
          properties={properties}
          initialMapView={initialMapView ?? false}
        />

        <section className="mt-10 border-t border-gray-200 pt-8" aria-label="SEO-текст">
          <h2 className="text-2xl font-semibold text-gray-900">Недвижимость в Краснодарском крае</h2>
          <p className="mt-4 max-w-4xl text-sm text-gray-600 md:text-base">{seoText}</p>
        </section>

        <section className="mt-10 border-t border-gray-200 pt-8" aria-label="Похожие SEO-ссылки">
          <h2 className="text-lg font-semibold text-gray-900">Похожие запросы</h2>
          <ul className="mt-4 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
            {seoLinks.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="hover:text-gray-900 hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </Container>
    </div>
  );
}
