import type { Metadata } from "next";
import { CatalogPageTemplate } from "@/components/catalog/CatalogPageTemplate";
import { siteOrigin } from "@/lib/articleSeo";
import {
  catalogViewIsMap,
  type CatalogPageSearchRecord,
} from "@/lib/catalogQueryParams";
import {
  catalogApiParamsFromUiState,
  catalogOrderingParam,
  parseCatalogUiState,
} from "@/lib/catalogFilters";
import { fetchPublicPropertiesListWithMeta } from "@/lib/publicPropertyList";

const catalogSeoText =
  "Каталог Centreal собрал предложения по продаже недвижимости в Краснодаре и Геленджике. В одном месте можно просматривать квартиры, дома, участки и коммерческие помещения, сравнивать стоимость и выбирать локацию под ваши задачи.";

const catalogSeoLinks = [
  { label: "Купить квартиру в Краснодаре", href: "/krasnodar/kupit-kvartiru" },
  { label: "Купить дом в Краснодаре", href: "/krasnodar/kupit-dom" },
  { label: "Купить участок в Геленджике", href: "/gelendzhik/kupit-uchastok" },
  {
    label: "Купить коммерческое помещение в Краснодаре",
    href: "/krasnodar/kupit-kommercheskuyu-nedvizhimost",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Каталог недвижимости — Centreal",
    description: catalogSeoText.slice(0, 160),
    alternates: { canonical: `${siteOrigin()}/catalog` },
  };
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogPageSearchRecord>;
}) {
  const sp = await searchParams;
  // ONE interpreter: the API query is a projection of the SAME parsed state
  // the panel and chips render from, so a filter can never apply without a
  // chip (or a chip show without its filter). See catalogApiParamsFromUiState.
  const uiState = parseCatalogUiState(sp);
  const apiParams = catalogApiParamsFromUiState(uiState);
  // Sorts the API supports are requested server-side (?ordering=…). «По
  // площади» has no API ordering field — the template's full-set sort covers
  // it (documented limitation until a backend ordering field exists).
  const ordering = catalogOrderingParam(uiState.sort);
  if (ordering) apiParams.ordering = ordering;

  const { items: properties, hiddenUnknownFloors } =
    await fetchPublicPropertiesListWithMeta({ searchParams: apiParams });
  return (
    <CatalogPageTemplate
      hiddenUnknownFloors={hiddenUnknownFloors}
      breadcrumbs={[
        { label: "Главная", href: "/" },
        { label: "Каталог" },
      ]}
      title="Каталог недвижимости"
      subtitle="Продажа квартир, домов, участков и коммерческих помещений"
      properties={properties}
      seoText={catalogSeoText}
      seoLinks={catalogSeoLinks}
      catalogSearchParams={sp}
      initialMapView={catalogViewIsMap(sp)}
    />
  );
}
