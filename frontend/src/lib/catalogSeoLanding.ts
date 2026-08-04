import type { Metadata } from "next";
import type { CatalogPropertyItem } from "@/components/catalog/types";
import { resolveSeoLandingPageBody } from "@/data/seoPages";
import { siteOrigin } from "@/lib/articleSeo";
import {
  buildSeoLandingDocumentTitle,
  buildSeoLandingH1,
  buildSeoLandingMetaDescription,
} from "@/lib/seoLandingTemplates";

export const CITY_SLUGS = ["krasnodar", "gelendzhik"] as const;
export type CitySlug = (typeof CITY_SLUGS)[number];

export function isCitySlug(value: string): value is CitySlug {
  return (CITY_SLUGS as readonly string[]).includes(value);
}

/** Имя города в предложном падеже после «в» */
const CITY_PREP: Record<CitySlug, string> = {
  krasnodar: "Краснодаре",
  gelendzhik: "Геленджике",
};

/** Районы: slug → название для H1 */
const DISTRICTS: Record<CitySlug, Record<string, string>> = {
  krasnodar: {
    festivalnyy: "Фестивальный",
    yubileynyy: "Юбилейный",
    "nemetskaya-derevnya": "Немецкая деревня",
    tsentr: "Центр",
  },
  gelendzhik: {
    "golubaya-buhta": "Голубая бухта",
    "tolstyy-mys": "Толстый мыс",
  },
};

/** Микрорайоны: slug → фраза для H1 (уже с пояснением при необходимости) */
const NEIGHBORHOODS: Record<CitySlug, Record<string, string>> = {
  krasnodar: {
    chistyakova: "микрорайон Чистякова",
  },
  gelendzhik: {
    "morskaya-2": "Морская-2",
  },
};

/** ЖК: slug → краткое имя для заголовков */
const RESIDENTIAL_COMPLEXES: Record<CitySlug, Record<string, string>> = {
  krasnodar: {
    samolet: "Самолёт",
  },
  gelendzhik: {
    "morskoy-briz": "Морской бриз",
  },
};

const KUPIT_KVARTIRU_RAJON_PREFIX = "kupit-kvartiru-rajon-";
const KUPIT_KVARTIRU_MIKRORAJON_PREFIX = "kupit-kvartiru-mikrorajon-";

const ROOM_COUNT_TO_SEGMENT: Record<1 | 2 | 3, string> = {
  1: "kupit-1-komnatnuyu-kvartiru",
  2: "kupit-2-komnatnuyu-kvartiru",
  3: "kupit-3-komnatnuyu-kvartiru",
};

/** Родительский район микрорайона (для внутренних ссылок) */
const NEIGHBORHOOD_PARENT_DISTRICT: Record<CitySlug, Record<string, string>> = {
  krasnodar: { chistyakova: "festivalnyy" },
  gelendzhik: { "morskaya-2": "golubaya-buhta" },
};

/** Район ЖК (минимальная детерминированная привязка для перекрёстных ссылок) */
const COMPLEX_DISTRICT: Record<CitySlug, Record<string, string>> = {
  krasnodar: { samolet: "festivalnyy" },
  gelendzhik: { "morskoy-briz": "golubaya-buhta" },
};

export type LandingResolved =
  | { kind: "property_type"; propertyType: NonNullable<CatalogPropertyItem["propertyType"]> }
  | { kind: "rooms"; rooms: 1 | 2 | 3 }
  | { kind: "district"; districtSlug: string; labelRu: string }
  | { kind: "neighborhood"; neighborhoodSlug: string; labelRu: string }
  | { kind: "zhk"; complexSlug: string; labelRu: string };

const SEGMENT_TO_TYPE: Record<string, NonNullable<CatalogPropertyItem["propertyType"]>> = {
  "kupit-kvartiru": "apartment",
  "kupit-dom": "house",
  "kupit-uchastok": "land",
  "kupit-kommercheskuyu-nedvizhimost": "commercial",
};

const SEGMENT_TO_ROOMS: Record<string, 1 | 2 | 3> = {
  "kupit-1-komnatnuyu-kvartiru": 1,
  "kupit-2-komnatnuyu-kvartiru": 2,
  "kupit-3-komnatnuyu-kvartiru": 3,
};

export function resolveCatalogSegment(
  city: CitySlug,
  segment: string,
): LandingResolved | null {
  const trimmed = segment.trim();
  if (!trimmed) return null;

  if (SEGMENT_TO_TYPE[trimmed]) {
    return { kind: "property_type", propertyType: SEGMENT_TO_TYPE[trimmed] };
  }
  if (SEGMENT_TO_ROOMS[trimmed]) {
    return { kind: "rooms", rooms: SEGMENT_TO_ROOMS[trimmed] };
  }

  if (trimmed.startsWith("zhk-")) {
    const complexSlug = trimmed.slice("zhk-".length);
    if (!complexSlug || complexSlug.includes("/")) return null;
    const name = RESIDENTIAL_COMPLEXES[city][complexSlug];
    if (!name) return null;
    return { kind: "zhk", complexSlug, labelRu: name };
  }

  if (trimmed.startsWith(KUPIT_KVARTIRU_RAJON_PREFIX)) {
    const districtSlug = trimmed.slice(KUPIT_KVARTIRU_RAJON_PREFIX.length);
    if (!districtSlug || districtSlug.includes("/")) return null;
    const districtName = DISTRICTS[city][districtSlug];
    if (!districtName) return null;
    return { kind: "district", districtSlug, labelRu: districtName };
  }

  if (trimmed.startsWith(KUPIT_KVARTIRU_MIKRORAJON_PREFIX)) {
    const neighborhoodSlug = trimmed.slice(KUPIT_KVARTIRU_MIKRORAJON_PREFIX.length);
    if (!neighborhoodSlug || neighborhoodSlug.includes("/")) return null;
    const nhLabel = NEIGHBORHOODS[city][neighborhoodSlug];
    if (!nhLabel) return null;
    return { kind: "neighborhood", neighborhoodSlug, labelRu: nhLabel };
  }

  return null;
}

export function filterPropertiesForLanding(
  items: CatalogPropertyItem[],
  city: CitySlug,
  resolved: LandingResolved,
): CatalogPropertyItem[] {
  const inCity = items.filter((p) => p.citySlug === city);

  switch (resolved.kind) {
    case "property_type":
      return inCity.filter((p) => p.propertyType === resolved.propertyType);
    case "rooms":
      return inCity.filter(
        (p) => p.propertyType === "apartment" && p.rooms === resolved.rooms,
      );
    case "district":
      return inCity.filter(
        (p) => p.propertyType === "apartment" && p.districtSlug === resolved.districtSlug,
      );
    case "neighborhood":
      return inCity.filter(
        (p) =>
          p.propertyType === "apartment" && p.neighborhoodSlug === resolved.neighborhoodSlug,
      );
    case "zhk":
      return inCity.filter((p) => p.residentialComplexSlug === resolved.complexSlug);
  }
}

export function buildLandingH1(city: CitySlug, resolved: LandingResolved): string {
  return buildSeoLandingH1(CITY_PREP[city], resolved);
}

export function buildLandingMetadata(input: {
  city: CitySlug;
  catalogSegment: string;
  resolved: LandingResolved;
}): Metadata {
  const { city, catalogSegment, resolved } = input;
  const where = CITY_PREP[city];
  const path = `/${city}/${catalogSegment}`;
  const canonical = `${siteOrigin()}${encodeURI(path)}`;

  return {
    title: buildSeoLandingDocumentTitle(where, resolved),
    description: buildSeoLandingMetaDescription(where, resolved),
    alternates: { canonical },
  };
}

export function buildLandingSubtitle(city: CitySlug, resolved: LandingResolved): string {
  const where = CITY_PREP[city];
  switch (resolved.kind) {
    case "zhk":
      return "Объявления о продаже в выбранном жилом комплексе";
    case "district":
    case "neighborhood":
      return "Квартиры в выбранной локации — список актуальных предложений";
    case "rooms":
      return "Квартиры с заданным числом комнат";
    case "property_type":
      return `Актуальные объявления о продаже в ${where}`;
  }
}

/** SEO-текст страницы из слоя seo_pages (`src/data/seoPages.ts`), с явным fallback */
export function buildLandingSeoText(city: CitySlug, catalogSegment: string): string {
  return resolveSeoLandingPageBody(city, catalogSegment);
}

const INTERNAL_LINKS_MAX = 8;

function sortedDistrictSlugs(city: CitySlug): string[] {
  return Object.keys(DISTRICTS[city]).sort();
}

function sortedComplexSlugs(city: CitySlug): string[] {
  return Object.keys(RESIDENTIAL_COMPLEXES[city]).sort();
}

/**
 * Внутренние ссылки на смежные SEO-посадочные страницы (детерминированно, без дублей текущего URL).
 */
export function buildLandingInternalLinks(
  city: CitySlug,
  catalogSegment: string,
  resolved: LandingResolved,
): { label: string; href: string }[] {
  const self = `/${city}/${catalogSegment.trim()}`;
  const where = CITY_PREP[city];
  const otherCity: CitySlug = city === "krasnodar" ? "gelendzhik" : "krasnodar";
  const districtHref = (slug: string) => `/${city}/${KUPIT_KVARTIRU_RAJON_PREFIX}${slug}`;
  const nhHref = (slug: string) => `/${city}/${KUPIT_KVARTIRU_MIKRORAJON_PREFIX}${slug}`;
  const zhkHref = (slug: string) => `/${city}/zhk-${slug}`;

  const primary: { label: string; href: string }[] = [];

  const pushRoomVariants = (exclude?: 1 | 2 | 3) => {
    ([1, 2, 3] as const).forEach((n) => {
      if (exclude === n) return;
      primary.push({
        label: `Купить ${n}-комнатную квартиру в ${where}`,
        href: `/${city}/${ROOM_COUNT_TO_SEGMENT[n]}`,
      });
    });
  };

  const pushTopDistricts = (limit: number, skipSlug?: string) => {
    sortedDistrictSlugs(city)
      .filter((s) => s !== skipSlug)
      .slice(0, limit)
      .forEach((slug) => {
        primary.push({
          label: `Квартиры в районе ${DISTRICTS[city][slug]}`,
          href: districtHref(slug),
        });
      });
  };

  const pushTopZhk = (limit: number, skipSlug?: string) => {
    sortedComplexSlugs(city)
      .filter((s) => s !== skipSlug)
      .slice(0, limit)
      .forEach((slug) => {
        primary.push({
          label: `ЖК ${RESIDENTIAL_COMPLEXES[city][slug]}`,
          href: zhkHref(slug),
        });
      });
  };

  switch (resolved.kind) {
    case "property_type":
      if (resolved.propertyType === "apartment") {
        pushRoomVariants();
        pushTopDistricts(3);
        pushTopZhk(2);
      }
      break;
    case "rooms":
      pushRoomVariants(resolved.rooms);
      pushTopDistricts(2);
      break;
    case "district":
      pushRoomVariants();
      sortedDistrictSlugs(city)
        .filter((s) => s !== resolved.districtSlug)
        .slice(0, 2)
        .forEach((slug) => {
          primary.push({
            label: `Квартиры в районе ${DISTRICTS[city][slug]}`,
            href: districtHref(slug),
          });
        });
      Object.keys(NEIGHBORHOODS[city])
        .filter((nh) => NEIGHBORHOOD_PARENT_DISTRICT[city]?.[nh] === resolved.districtSlug)
        .sort()
        .slice(0, 2)
        .forEach((nhSlug) => {
          primary.push({
            label: `Квартиры, ${NEIGHBORHOODS[city][nhSlug]}`,
            href: nhHref(nhSlug),
          });
        });
      pushTopZhk(1);
      break;
    case "neighborhood": {
      const parent = NEIGHBORHOOD_PARENT_DISTRICT[city]?.[resolved.neighborhoodSlug];
      if (parent) {
        primary.push({
          label: `Квартиры в районе ${DISTRICTS[city][parent]}`,
          href: districtHref(parent),
        });
      }
      pushRoomVariants();
      pushTopDistricts(2, parent);
      break;
    }
    case "zhk": {
      const dSlug = COMPLEX_DISTRICT[city]?.[resolved.complexSlug];
      if (dSlug) {
        primary.push({
          label: `Квартиры в районе ${DISTRICTS[city][dSlug]}`,
          href: districtHref(dSlug),
        });
      }
      pushRoomVariants();
      pushTopZhk(2, resolved.complexSlug);
      break;
    }
    default:
      break;
  }

  const staples: { label: string; href: string }[] = [
    { label: `Купить квартиру в ${where}`, href: `/${city}/kupit-kvartiru` },
    { label: `Купить дом в ${where}`, href: `/${city}/kupit-dom` },
    { label: `Купить участок в ${where}`, href: `/${city}/kupit-uchastok` },
    {
      label: `Коммерческая недвижимость в ${where}`,
      href: `/${city}/kupit-kommercheskuyu-nedvizhimost`,
    },
    { label: `Купить квартиру в ${CITY_PREP[otherCity]}`, href: `/${otherCity}/kupit-kvartiru` },
    { label: "Общий каталог", href: "/catalog" },
  ];

  const out: { label: string; href: string }[] = [];
  const seen = new Set<string>();

  const add = (label: string, href: string) => {
    if (href === self || seen.has(href) || out.length >= INTERNAL_LINKS_MAX) return;
    seen.add(href);
    out.push({ label, href });
  };

  for (const { label, href } of primary) add(label, href);
  for (const { label, href } of staples) add(label, href);

  return out;
}

/**
 * The catalog-filter record a landing route RESOLVES TO. Passed to
 * CatalogPageTemplate so the filter panel pre-fills, the chips reflect the
 * route's real filters, and any interaction continues on /catalog with that
 * state carried over. ЖК landings map to city-only: the panel has no
 * residential-complex filter, and claiming less is honest — the H1/subtitle
 * still name the complex.
 */
export function landingImpliedSearchRecord(
  city: CitySlug,
  resolved: LandingResolved,
): Record<string, string> {
  switch (resolved.kind) {
    case "property_type":
      return { city_slug: city, property_type: resolved.propertyType };
    case "rooms":
      return {
        city_slug: city,
        property_type: "apartment",
        rooms: String(resolved.rooms),
      };
    case "district":
      return {
        city_slug: city,
        property_type: "apartment",
        district_slug: resolved.districtSlug,
      };
    case "neighborhood":
      return {
        city_slug: city,
        property_type: "apartment",
        neighborhood_slug: resolved.neighborhoodSlug,
      };
    case "zhk":
    default:
      return { city_slug: city };
  }
}

export function landingBreadcrumbCurrentLabel(resolved: LandingResolved): string {
  switch (resolved.kind) {
    case "property_type":
      return "Тип недвижимости";
    case "rooms":
      return "Комнатность";
    case "district":
      return "Район";
    case "neighborhood":
      return "Микрорайон";
    case "zhk":
      return "Жилой комплекс";
    default:
      return "Подборка";
  }
}

/** Детерминированные публичные SEO-посадочные пути (как в `resolveCatalogSegment`). */
export function listSeoLandingPaths(): string[] {
  const paths: string[] = [];
  const typeSegments = Object.keys(SEGMENT_TO_TYPE).sort();
  const roomSegments = Object.keys(SEGMENT_TO_ROOMS).sort();

  for (const city of CITY_SLUGS) {
    for (const seg of typeSegments) {
      if (resolveCatalogSegment(city, seg)) {
        paths.push(`/${city}/${seg}`);
      }
    }
    for (const seg of roomSegments) {
      if (resolveCatalogSegment(city, seg)) {
        paths.push(`/${city}/${seg}`);
      }
    }
    for (const d of sortedDistrictSlugs(city)) {
      const seg = `${KUPIT_KVARTIRU_RAJON_PREFIX}${d}`;
      if (resolveCatalogSegment(city, seg)) {
        paths.push(`/${city}/${seg}`);
      }
    }
    for (const n of Object.keys(NEIGHBORHOODS[city]).sort()) {
      const seg = `${KUPIT_KVARTIRU_MIKRORAJON_PREFIX}${n}`;
      if (resolveCatalogSegment(city, seg)) {
        paths.push(`/${city}/${seg}`);
      }
    }
    for (const z of sortedComplexSlugs(city)) {
      const seg = `zhk-${z}`;
      if (resolveCatalogSegment(city, seg)) {
        paths.push(`/${city}/${seg}`);
      }
    }
  }
  return paths.sort();
}
