import type { CatalogPropertyItem } from "@/components/catalog/types";
import { formatPropertyPrice } from "@/lib/propertySeo";

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
  photos: { url: string | null; sort_order: number; is_main: boolean }[];
  videos: { video_url: string }[];
  assigned_realtor: {
    id: number;
    crm_id: string;
    first_name: string;
    last_name: string;
    avatar?: string | null;
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

function locationLine(p: PublicPropertyDetail): string {
  const c = p.city?.name;
  const d = p.district?.name;
  if (c && d) return `${c}, ${d}`;
  return c || d || p.public_address_text || "";
}

function characteristicsLine(p: PublicPropertyDetail): string {
  const parts: string[] = [];
  const ad = p.apartment_details;
  const hd = p.house_details;
  const ld = p.land_plot_details;
  const cd = p.commercial_details;
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

export function mapPublicDetailToCatalogItem(
  p: PublicPropertyDetail,
  slug: string,
): CatalogPropertyItem {
  const photoUrls = p.photos
    .filter((x) => x.url)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((x) => x.url as string);
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
  const realtorCrmId =
    typeof p.assigned_realtor?.crm_id === "string" && p.assigned_realtor.crm_id.trim()
      ? p.assigned_realtor.crm_id.trim()
      : undefined;

  const lat = p.public_latitude != null ? Number(p.public_latitude) : 0;
  const lng = p.public_longitude != null ? Number(p.public_longitude) : 0;

  return {
    id: p.id,
    slug,
    image: main,
    price: formatPropertyPrice(p),
    title: p.title_generated,
    characteristics: characteristicsLine(p),
    location: locationLine(p),
    href: `/catalog/${slug}`,
    latitude: Number.isFinite(lat) ? lat : 0,
    longitude: Number.isFinite(lng) ? lng : 0,
    updatedAt: p.updated_at,
    gallery: gallery ?? (photoUrls.length > 1 ? photoUrls : undefined),
    videoUrl,
    propertyType: p.property_type,
    rooms: p.apartment_details?.rooms,
    area: p.apartment_details
      ? Number(p.apartment_details.area_total)
      : p.land_plot_details
        ? Number(p.land_plot_details.land_area)
        : p.commercial_details
          ? Number(p.commercial_details.area_total)
          : p.house_details
            ? Number(p.house_details.house_area)
            : undefined,
    floor: p.apartment_details?.floor ?? p.commercial_details?.floor ?? undefined,
    totalFloors:
      p.apartment_details?.floors_total ??
      p.commercial_details?.floors_total ??
      p.house_details?.floors_total ??
      undefined,
    district: p.district?.name,
    description: p.description || p.short_description,
    realtorName,
    realtorAvatar,
    realtorCrmId,
  };
}
