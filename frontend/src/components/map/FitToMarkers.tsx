"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

import { ALL_CIRCLES } from "@/components/address/addressMapConstants";

/**
 * ⭐ THE SHARED "FRAME THE MARKERS" BEHAVIOUR FOR EVERY MULTI-MARKER MAP.
 *
 * ⚠ THIS FILE IMPORTS LEAFLET — only ever render it inside a map that is
 * already loaded with `next/dynamic({ ssr: false })`, never import a constant
 * from it into a server-rendered module.
 *
 * ⚠ MapContainer's `center`/`zoom` are MOUNT-ONLY in this project (react-leaflet
 * ignores later changes, because the underlying map is imperative), which is why
 * this is a child component calling `useMap()` — the same convention
 * `AddressPickerMap`'s `Recenter` already uses. Do not try to drive the view
 * from props on MapContainer.
 *
 * WHY IT EXISTS: the maps opened at a hardcoded centre+zoom. With listings
 * spread from Krasnodar to Архипо-Осиповка — about 100 km — a zoom-11 view of
 * their centroid lands in the hills between the two and shows NO markers at
 * all. On the homepage that reads as "there are no listings".
 */

/** Zoom used for a single marker. fitBounds on a zero-area box goes to max. */
export const SINGLE_MARKER_ZOOM = 15;

/**
 * Markers closer together than this are treated as one point, so a cluster of
 * near-identical coordinates gets `SINGLE_MARKER_ZOOM` rather than a bounding
 * box a few metres across (which fitBounds would also resolve to max zoom).
 * ~0.0005° is roughly 55 m — two flats in one building, one house pinned twice.
 */
const DEGENERATE_SPAN_DEG = 0.0005;

/** Padding so an edge marker is not flush against the frame. */
const FIT_PADDING: [number, number] = [48, 48];

export type MarkerPoint = { lat: number; lng: number };

/** Bounds covering every service circle — the fallback when there is nothing to fit. */
export function serviceAreaBounds(): L.LatLngBounds {
  const pts: L.LatLngTuple[] = [];
  for (const c of ALL_CIRCLES) {
    // A degree of latitude is ~111.32 km; longitude shrinks with the cosine.
    const dLat = c.radiusKm / 111.32;
    const dLon = c.radiusKm / (111.32 * Math.cos((c.center.lat * Math.PI) / 180));
    pts.push([c.center.lat - dLat, c.center.lng - dLon]);
    pts.push([c.center.lat + dLat, c.center.lng + dLon]);
  }
  return L.latLngBounds(pts);
}

/** A stable identity for a marker set: refit only when the SET really changes. */
export function markerSetKey(points: MarkerPoint[]): string {
  return points
    .map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
    .sort()
    .join("|");
}

interface FitToMarkersProps {
  points: MarkerPoint[];
  /** Changes to this force a refit even if the coordinates are unchanged. */
  fitKey?: string;
}

export function FitToMarkers({ points, fitKey }: FitToMarkersProps) {
  const map = useMap();
  const key = markerSetKey(points) + "|" + (fitKey ?? "");
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    // ⚠ REFIT ONLY WHEN THE MARKER SET CHANGES — never on every render.
    // The user's pan/zoom is intent; yanking the view back on an unrelated
    // re-render (a parent state change, a hover, a resize) discards it. The key
    // is derived from the coordinates themselves, so a re-render that produces
    // the same markers is a no-op.
    if (lastKey.current === key) return;
    lastKey.current = key;

    if (points.length === 0) {
      // Nothing to fit. Fitting an empty bounds throws; showing the whole
      // service area at least tells the reader where the platform operates.
      map.fitBounds(serviceAreaBounds(), { padding: FIT_PADDING });
      return;
    }

    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const spanLat = Math.max(...lats) - Math.min(...lats);
    const spanLng = Math.max(...lngs) - Math.min(...lngs);

    if (points.length === 1 || (spanLat < DEGENERATE_SPAN_DEG && spanLng < DEGENERATE_SPAN_DEG)) {
      // One marker, or several on top of each other: a zero-area box would
      // zoom to the maximum and show a doorstep. Street level is the useful view.
      map.setView([lats[0], lngs[0]], SINGLE_MARKER_ZOOM);
      return;
    }

    // ⚠ NO maxZoom CAP HERE, DELIBERATELY. Two distant clusters (Krasnodar and
    // the Gelendzhik coast) legitimately fit at a low zoom — seeing every object
    // at once is exactly what was asked for. Capping the zoom-out would put the
    // original bug back.
    map.fitBounds(
      L.latLngBounds(points.map((p) => [p.lat, p.lng] as L.LatLngTuple)),
      { padding: FIT_PADDING },
    );
  }, [map, key, points]);

  return null;
}
