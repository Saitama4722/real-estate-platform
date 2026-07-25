import type { CatalogCitySlug, CatalogPropertyItem } from "@/components/catalog/types";
import { getPublicApiBaseUrl } from "@/lib/publicProperty";

const CURRENCY_LABEL: Record<string, string> = {
  rub: "₽",
  usd: "$",
  eur: "€",
};

export interface PublicPropertyListItemRaw {
  id: number;
  title_generated: string;
  slug: string | null;
  property_type: "apartment" | "house" | "land" | "commercial";
  deal_type: string;
  price: string;
  /** Decimal string, or null when the realtor left it blank. Manual, unverified. */
  old_price?: string | null;
  currency: string;
  public_address_text: string;
  public_latitude: string | null;
  public_longitude: string | null;
  updated_at: string;
  city: { id: number; name: string; slug: string } | null;
  district: { id: number; name: string; slug: string } | null;
  neighborhood: { id: number; name: string; slug: string } | null;
  residential_complex: { id: number; name: string; slug: string } | null;
  apartment_details: {
    rooms: number;
    area_total: string;
    floor: number;
    floors_total: number;
  } | null;
  house_details: {
    house_area: string;
    land_area: string;
    floors_total: number;
  } | null;
  land_plot_details: { land_area: string } | null;
  commercial_details: {
    commercial_type: string | null;
    area_total: string;
    floor: number | null;
    floors_total: number | null;
  } | null;
  preview_image: string | null;
  is_price_reduced?: boolean;
  is_new?: boolean;
}

/** Decimal string → number, or undefined when absent/blank/unparseable. */
function optionalDecimal(v: string | null | undefined): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function formatListPrice(price: string, currency: string): string {
  const sym = CURRENCY_LABEL[currency] ?? currency;
  const n = Number(price);
  if (Number.isNaN(n)) return `${price} ${sym}`;
  return `${new Intl.NumberFormat("ru-RU").format(n)} ${sym}`;
}

function asCitySlug(slug: string | undefined): CatalogCitySlug | undefined {
  if (slug === "krasnodar" || slug === "gelendzhik") return slug;
  return undefined;
}

function locationLine(row: PublicPropertyListItemRaw): string {
  const c = row.city?.name?.trim();
  const d = row.district?.name?.trim();
  if (c && d) return `${c}, ${d}`;
  return c || d || row.public_address_text || "";
}

function listingCharacteristics(row: PublicPropertyListItemRaw): string {
  const parts: string[] = [];
  const ad = row.apartment_details;
  const hd = row.house_details;
  const ld = row.land_plot_details;
  const cd = row.commercial_details;
  if (ad) {
    parts.push(`${ad.rooms} комн.`);
    parts.push(`${ad.area_total} м²`);
    parts.push(`${ad.floor}/${ad.floors_total} этаж`);
  } else if (hd) {
    parts.push(`${hd.house_area} м²`);
    parts.push(`участок ${hd.land_area} сот.`);
  } else if (ld) {
    parts.push(`${ld.land_area} сот.`);
  } else if (cd) {
    parts.push(`${cd.area_total} м²`);
  }
  return parts.join(" • ");
}

export function mapPublicListItemToCatalogItem(row: PublicPropertyListItemRaw): CatalogPropertyItem {
  const pathSlug = (row.slug?.trim() || String(row.id)).trim();
  const lat = row.public_latitude != null ? Number(row.public_latitude) : 0;
  const lng = row.public_longitude != null ? Number(row.public_longitude) : 0;
  const image = row.preview_image?.trim() || "Фото объекта";

  return {
    id: row.id,
    slug: row.slug?.trim() || undefined,
    citySlug: asCitySlug(row.city?.slug),
    districtSlug: row.district?.slug,
    neighborhood: row.neighborhood?.name,
    neighborhoodSlug: row.neighborhood?.slug,
    residentialComplexSlug: row.residential_complex?.slug,
    image,
    price: formatListPrice(row.price, row.currency),
    title: row.title_generated || "Объект",
    characteristics: listingCharacteristics(row),
    location: locationLine(row),
    href: `/catalog/${pathSlug}`,
    latitude: Number.isFinite(lat) ? lat : 0,
    longitude: Number.isFinite(lng) ? lng : 0,
    updatedAt: row.updated_at,
    propertyType: row.property_type,
    rooms: row.apartment_details?.rooms,
    area: row.apartment_details
      ? Number(row.apartment_details.area_total)
      : row.land_plot_details
        ? Number(row.land_plot_details.land_area)
        : row.commercial_details
          ? Number(row.commercial_details.area_total)
          : row.house_details
            ? Number(row.house_details.house_area)
            : undefined,
    floor: row.apartment_details?.floor ?? row.commercial_details?.floor ?? undefined,
    totalFloors:
      row.apartment_details?.floors_total ??
      row.commercial_details?.floors_total ??
      row.house_details?.floors_total ??
      undefined,
    district: row.district?.name,
    isPriceReduced: row.is_price_reduced === true,
    oldPrice: optionalDecimal(row.old_price),
    isNew: row.is_new === true,
  };
}

function normalizeListPayload(
  data: unknown,
): PublicPropertyListItemRaw[] {
  if (Array.isArray(data)) {
    return data as PublicPropertyListItemRaw[];
  }
  if (data && typeof data === "object" && "results" in data) {
    const r = (data as { results?: unknown }).results;
    if (Array.isArray(r)) return r as PublicPropertyListItemRaw[];
  }
  return [];
}

/**
 * Published properties for каталог / карты / SEO-посадочных страниц.
 * Query-параметры совпадают с публичным API Django (`city_slug`, `district_slug`, …).
 */
export async function fetchPublicPropertiesList(options?: {
  searchParams?: Record<string, string | number | undefined>;
}): Promise<CatalogPropertyItem[]> {
  const base = getPublicApiBaseUrl();
  const u = new URL(`${base}/properties/`);
  if (options?.searchParams) {
    for (const [k, v] of Object.entries(options.searchParams)) {
      if (v === undefined || v === "") continue;
      u.searchParams.set(k, String(v));
    }
  }
  try {
    const res = await fetch(u.toString(), { next: { revalidate: 60 } });
    if (!res.ok) {
      console.error("[fetchPublicPropertiesList] HTTP", res.status, u.toString());
      return [];
    }
    const raw = await res.json();
    return normalizeListPayload(raw).map(mapPublicListItemToCatalogItem);
  } catch (e) {
    console.error("[fetchPublicPropertiesList]", u.toString(), e);
    return [];
  }
}
