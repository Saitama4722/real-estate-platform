import type { CatalogCitySlug, CatalogPropertyItem } from "@/components/catalog/types";
import { formatPropertyPrice } from "@/lib/propertySeo";
import { formatOldPrice, marketLabelFor } from "@/lib/propertyBadges";
import {
  formatArea,
  tidyDecimalsInText,
  type AreaField,
} from "@/lib/propertyArea";
import { buildLocationLine } from "@/lib/propertyLocation";

/** Narrow an arbitrary city slug to the two known landing-city slugs. */
function asCitySlug(slug: string | undefined): CatalogCitySlug | undefined {
  if (slug === "krasnodar" || slug === "gelendzhik") return slug;
  return undefined;
}

export interface PublicLocationShort {
  id: number;
  name: string;
  slug: string;
}

export interface PublicPropertyDetail {
  id: number;
  slug: string | null;
  title_generated: string;
  property_type: "apartment" | "house" | "land" | "commercial";
  deal_type: string;
  price: string;
  currency: string;
  public_address_text: string;
  public_latitude: string | null;
  public_longitude: string | null;
  short_description: string;
  description: string;
  updated_at: string;
  city: PublicLocationShort | null;
  district: PublicLocationShort | null;
  /** Микрорайон. The detail API has always sent it; the page never read it. */
  neighborhood?: PublicLocationShort | null;
  residential_complex?: PublicLocationShort | null;
  /*
   * The FULL per-type characteristics (`*DetailsDetailSerializer`). Everything past
   * the first few keys is optional so a payload cached before the fields shipped
   * still parses. `*_label` is the server-side label of the Django choice, the
   * same enum the CRM form's selects use.
   */
  apartment_details: {
    rooms: number;
    area_total: string;
    floor: number;
    floors_total: number | null;
    area_living?: string | null;
    area_kitchen?: string | null;
    has_balcony?: boolean;
    has_loggia?: boolean;
    renovation_type?: string | null;
    renovation_type_label?: string | null;
    bathroom_type?: string | null;
    bathroom_type_label?: string | null;
  } | null;
  house_details: {
    house_area: string;
    land_area: string;
    floors_total: number;
    heating_type?: string | null;
    heating_type_label?: string | null;
    building_type?: string | null;
    building_type_label?: string | null;
    has_gas?: boolean;
    has_water?: boolean;
    has_sewerage?: boolean;
    has_electricity?: boolean;
  } | null;
  land_plot_details: {
    land_area: string;
    land_category?: string | null;
    land_category_label?: string | null;
    permitted_use?: string | null;
    permitted_use_label?: string | null;
    has_gas?: boolean;
    has_water?: boolean;
    has_electricity?: boolean;
  } | null;
  commercial_details: {
    commercial_type: string | null;
    commercial_type_label?: string | null;
    area_total: string;
    floor: number | null;
    floors_total: number | null;
    entrance_type?: string | null;
    parking_spaces?: number | null;
  } | null;
  /** Server order: the main photo first, then sort_order. */
  photos: {
    url: string | null;
    thumb?: string | null;
    large?: string | null;
    sort_order: number;
    is_main: boolean;
  }[];
  videos: { video_url: string }[];
  /** Chronological (ascending) price points; each price is a decimal string. */
  price_history?: { price: string; changed_at: string }[];
  /** True when current price is below the peak recorded price (see serializer). */
  is_price_reduced?: boolean;
  /** Published within the last 7 days (server-derived). */
  is_new?: boolean;
  /** Previous price; struck through on the card only when above the current one. */
  old_price?: string | null;
  /** "new_building" | "secondary" | "other" | null — card photo badge. */
  market_type?: string | null;
  assigned_realtor: {
    id: number;
    crm_id: string;
    first_name: string;
    last_name: string;
    avatar?: string | null;
    /** Whether /realtors/<crm_id> exists — links must be gated on it. */
    is_public?: boolean;
  } | null;
}

/** Public API base without trailing slash: server uses `BACKEND_URL`+`/api`, browser uses `NEXT_PUBLIC_API_URL`. */
export function getPublicApiBaseUrl(): string {
  const trim = (s: string) => s.replace(/\/$/, "");
  const devFallback = () =>
    process.env.NODE_ENV !== "production" ? trim("http://localhost:8001/api") : trim("");
  if (typeof window === "undefined") {
    const internal = process.env.BACKEND_URL?.trim();
    if (internal) {
      return trim(`${internal.replace(/\/+$/, "")}/api`);
    }
    const pub = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (pub) return trim(pub);
    return devFallback();
  }
  const pub = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (pub) return trim(pub);
  return devFallback();
}

export async function fetchPublicPropertyBySlug(
  slug: string,
): Promise<PublicPropertyDetail | null> {
  const enc = encodeURIComponent(slug);
  const url = `${getPublicApiBaseUrl()}/properties/${enc}/`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error("[fetchPublicPropertyBySlug] HTTP", res.status, url);
      return null;
    }
    return (await res.json()) as PublicPropertyDetail;
  } catch (e) {
    console.error("[fetchPublicPropertyBySlug]", url, e);
    return null;
  }
}

/**
 * The header line: city, district (not when it repeats the city), microdistrict,
 * complex, street. Location lives HERE and nowhere in «Характеристики».
 */
function locationLine(p: PublicPropertyDetail): string {
  return buildLocationLine(
    {
      city: p.city?.name,
      district: p.district?.name,
      neighborhood: p.neighborhood?.name,
      residentialComplex: p.residential_complex?.name,
      address: p.public_address_text,
    },
    { includeAddress: true },
  );
}

/** «54,5 м² • 3/9 этаж» — humanized: no «225.00», no «3/null». */
function characteristicsLine(p: PublicPropertyDetail): string {
  const parts: string[] = [];
  const ad = p.apartment_details;
  const hd = p.house_details;
  const ld = p.land_plot_details;
  const cd = p.commercial_details;
  if (ad) {
    parts.push(`${ad.rooms} комн.`);
    parts.push(formatArea(Number(ad.area_total), "area_total"));
    parts.push(ad.floors_total ? `${ad.floor}/${ad.floors_total} этаж` : `${ad.floor} этаж`);
  } else if (hd) {
    parts.push(formatArea(Number(hd.house_area), "house_area"));
    parts.push(`участок ${formatArea(Number(hd.land_area), "land_area")}`);
  } else if (ld) {
    parts.push(formatArea(Number(ld.land_area), "land_area"));
  } else if (cd) {
    parts.push(formatArea(Number(cd.area_total), "area_total"));
  }
  return parts.join(" • ");
}

/**
 * The few extra facts the COMPARE table reads. Everything else lives in the
 * characteristics block (`lib/propertyCharacteristics.ts`). Honest shape: only
 * fields the models really have, only when filled.
 */
function compareDetails(p: PublicPropertyDetail): CatalogPropertyItem["details"] {
  const ad = p.apartment_details;
  const hd = p.house_details;
  const ld = p.land_plot_details;
  const kitchen = ad?.area_kitchen != null ? Number(ad.area_kitchen) : 0;
  const utilities: string[] = [];
  const u = hd ?? ld;
  if (u?.has_gas) utilities.push("газ");
  if (u?.has_water) utilities.push("вода");
  if (hd?.has_sewerage) utilities.push("канализация");
  if (u?.has_electricity) utilities.push("электричество");
  const details: NonNullable<CatalogPropertyItem["details"]> = {};
  if (ad?.renovation_type_label) details.renovation = ad.renovation_type_label;
  if (hd?.building_type_label) details.material = hd.building_type_label;
  if (kitchen > 0) details.kitchenArea = formatArea(kitchen, "area_total");
  if (hd?.heating_type_label) details.heating = hd.heating_type_label;
  if (utilities.length) details.utilities = utilities.join(", ");
  return Object.keys(details).length ? details : undefined;
}

/** Headline area + the field it came from, and a house's plot size. */
function detailArea(p: {
  apartment_details: { area_total: string } | null;
  house_details: { house_area: string; land_area: string } | null;
  land_plot_details: { land_area: string } | null;
  commercial_details: { area_total: string } | null;
}): { area?: number; areaField?: AreaField; landArea?: number } {
  if (p.apartment_details) {
    return { area: Number(p.apartment_details.area_total), areaField: "area_total" };
  }
  if (p.land_plot_details) {
    return { area: Number(p.land_plot_details.land_area), areaField: "land_area" };
  }
  if (p.commercial_details) {
    return { area: Number(p.commercial_details.area_total), areaField: "area_total" };
  }
  if (p.house_details) {
    const land = Number(p.house_details.land_area);
    return {
      area: Number(p.house_details.house_area),
      areaField: "house_area",
      landArea: Number.isFinite(land) && land > 0 ? land : undefined,
    };
  }
  return {};
}

export function mapPublicDetailToCatalogItem(
  p: PublicPropertyDetail,
  slug: string,
): CatalogPropertyItem {
  // ⚠ Keep the SERVER order (main photo first). Re-sorting by sort_order here
  // used to make the cover ignore `is_main`.
  const withUrl = p.photos.filter((x) => x.url);
  const photoUrls = withUrl.map((x) => x.url as string);
  const photoThumbs = withUrl.map((x) => (x.thumb || x.url) as string);
  const photoLarge = withUrl.map((x) => (x.large || x.url) as string);
  const main = photoUrls[0] ?? "Фото объекта";
  const gallery = photoUrls.length > 1 ? photoUrls : undefined;

  const videoUrl = p.videos[0]?.video_url;

  const realtorName = p.assigned_realtor
    ? `${p.assigned_realtor.first_name} ${p.assigned_realtor.last_name}`.trim()
    : undefined;
  const realtorAvatar =
    typeof p.assigned_realtor?.avatar === "string" && p.assigned_realtor.avatar
      ? p.assigned_realtor.avatar
      : undefined;
  /*
   * Only set when the realtor's public page actually EXISTS. The page 404s
   * unless the profile has `is_public=True`, so gating here means no surface
   * can render a link into a 404 — the id simply is not there to link with.
   * Undefined for older API payloads that predate the flag, which is the safe
   * direction (no link rather than a possibly-dead one).
   */
  const realtorCrmId =
    typeof p.assigned_realtor?.crm_id === "string" &&
    p.assigned_realtor.crm_id.trim() &&
    p.assigned_realtor.is_public === true
      ? p.assigned_realtor.crm_id.trim()
      : undefined;

  const lat = p.public_latitude != null ? Number(p.public_latitude) : 0;
  const lng = p.public_longitude != null ? Number(p.public_longitude) : 0;

  return {
    id: p.id,
    slug,
    citySlug: asCitySlug(p.city?.slug),
    districtSlug: p.district?.slug,
    image: main,
    price: formatPropertyPrice(p),
    neighborhood: p.neighborhood?.name,
    neighborhoodSlug: p.neighborhood?.slug,
    residentialComplexSlug: p.residential_complex?.slug,
    title: tidyDecimalsInText(p.title_generated),
    characteristics: characteristicsLine(p),
    location: locationLine(p),
    href: `/catalog/${slug}`,
    latitude: Number.isFinite(lat) ? lat : 0,
    longitude: Number.isFinite(lng) ? lng : 0,
    updatedAt: p.updated_at,
    gallery: gallery ?? (photoUrls.length > 1 ? photoUrls : undefined),
    galleryThumbs: photoThumbs.length > 0 ? photoThumbs : undefined,
    galleryLarge: photoLarge.length > 0 ? photoLarge : undefined,
    videoUrl,
    propertyType: p.property_type,
    rooms: p.apartment_details?.rooms,
    // ⚠ Same rule as the LIST mapper: the field travels with the value, so the
    // unit is never guessed. Omitting it here made /favorites — which fetches
    // each property through THIS mapper — drop the area entirely, because the
    // card refuses to render a number whose unit it does not know.
    ...detailArea(p),
    floor: p.apartment_details?.floor ?? p.commercial_details?.floor ?? undefined,
    totalFloors:
      p.apartment_details?.floors_total ??
      p.commercial_details?.floors_total ??
      p.house_details?.floors_total ??
      undefined,
    district: p.district?.name,
    details: compareDetails(p),
    description: p.description || p.short_description,
    realtorName,
    realtorAvatar,
    realtorCrmId,
    priceHistory: Array.isArray(p.price_history)
      ? p.price_history
          .map((h) => ({ price: Number(h.price), changedAt: h.changed_at }))
          .filter((h) => Number.isFinite(h.price))
      : undefined,
    isPriceReduced: p.is_price_reduced === true,
    isNew: p.is_new === true,
    // Same derivations as the list mapper (shared module), so a card looks
    // identical whether it was hydrated from the list or the detail endpoint.
    oldPrice: formatOldPrice(p.old_price, p.price, (v) =>
      formatPropertyPrice({ ...p, price: v }),
    ),
    marketLabel: marketLabelFor(p.market_type),
  };
}
