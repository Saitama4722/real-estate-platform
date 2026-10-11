import { NextResponse } from "next/server";

import { geoContactUserAgent, NOMINATIM_BASE } from "@/lib/addressGeoShared";

/**
 * Reverse geocoding: coordinates -> nearest address.
 *
 * Used when the owner DRAGS the marker (or taps the map) to correct a suggestion
 * that landed slightly off. Same server-side reasoning as /geo/suggest: the
 * User-Agent the usage policy requires cannot be set from a browser.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number.parseFloat(searchParams.get("lat") ?? "");
  const lon = Number.parseFloat(searchParams.get("lon") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "bad_coords" }, { status: 400 });
  }

  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(lat),
    lon: String(lon),
    "accept-language": "ru",
    addressdetails: "1",
    // 18 = building level; without it Nominatim can answer with the whole city.
    zoom: "18",
  });

  try {
    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params.toString()}`, {
      headers: { "User-Agent": geoContactUserAgent(), Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }
    const raw = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const a = raw.address ?? {};
    const road = a.road ?? a.pedestrian ?? a.residential ?? "";
    const house = a.house_number ?? "";
    const short = [road, house].filter(Boolean).join(", ");
    return NextResponse.json({
      label: short || (raw.display_name ?? "").split(",").slice(0, 2).join(","),
      detail: raw.display_name ?? "",
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
