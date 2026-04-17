import { getPublicApiBaseUrl } from "@/lib/publicProperty";

export interface PublicRealtorDetail {
  crm_id: string;
  display_name: string;
  avatar: string | null;
  phone: string;
  published_properties_count: number;
  short_bio: string;
}

export async function fetchPublicRealtorByCrmId(
  crmId: string,
): Promise<PublicRealtorDetail | null> {
  const id = (crmId || "").trim();
  if (!id) return null;
  const enc = encodeURIComponent(id);
  const url = `${getPublicApiBaseUrl()}/realtors/${enc}/`;
  try {
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error("[fetchPublicRealtorByCrmId] HTTP", res.status, url);
      return null;
    }
    return (await res.json()) as PublicRealtorDetail;
  } catch (e) {
    console.error("[fetchPublicRealtorByCrmId]", url, e);
    return null;
  }
}
