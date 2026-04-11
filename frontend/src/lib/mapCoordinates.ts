import type { CatalogPropertyItem } from "@/components/catalog/types";

const EPS = 1e-5;

/** True when listing/map item should render a map marker (real coordinates). */
export function hasCatalogItemMapCoords(p: CatalogPropertyItem): boolean {
  return (
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    (Math.abs(p.latitude) > EPS || Math.abs(p.longitude) > EPS)
  );
}

/** True when public API returned usable coordinates for the object page map. */
export function hasPublicGeoStrings(lat: string | null, lng: string | null): boolean {
  if (lat == null || lng == null) return false;
  const s1 = String(lat).trim();
  const s2 = String(lng).trim();
  if (!s1 || !s2) return false;
  const la = Number(s1);
  const lo = Number(s2);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (Math.abs(la) < EPS && Math.abs(lo) < EPS) return false;
  return true;
}
