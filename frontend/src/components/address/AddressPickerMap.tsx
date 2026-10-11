"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  AttributionControl,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import {
  OSM_MAX_ZOOM,
  OSM_TILE_ATTRIBUTION,
  OSM_TILE_URL,
  type LatLng,
} from "@/components/address/addressMapConstants";

import { MapUnmountGuard } from "@/components/map/MapUnmountGuard";

/**
 * The Leaflet half of the address picker.
 *
 * ⚠ THIS FILE MUST ONLY EVER BE IMPORTED VIA next/dynamic({ ssr: false }).
 * It statically imports `leaflet`, which reads `window` at module-evaluation
 * time, so any server render of it fails with "window is not defined".
 * `React.lazy` is NOT sufficient — it defers loading but does not disable SSR.
 * See AddressPicker.tsx, which is the only place that loads it.
 */


/**
 * ⚠ MapContainer's `center`/`zoom` are MOUNT-ONLY — react-leaflet ignores later
 * changes to them, because the underlying Leaflet map is imperative. Recentring
 * therefore has to go through the map instance, which is what this does.
 * Do NOT try to drive `center` from props, and do NOT use a `key` remount hack
 * (tile flicker, and it silently no-ops when the same point is re-selected).
 *
 * ⚠ TWO BUGS LIVED HERE. Both are why the map sat on Krasnodar while Геленджик
 * and then Бетта were selected `[measured]`: centre 45.027/38.979 unchanged
 * across both selections.
 *
 * 1. This used to bail out unless a `point` existed (`if (point) …`), so
 *    choosing a city or settlement — which moves the FALLBACK centre, not the
 *    point — could never move the map. Combined with `MapContainer`'s
 *    mount-only `center`, the map was pinned to whatever was selected at mount,
 *    i.e. nothing. It now recentres on the resolved target, point or fallback.
 * 2. The dependency was the `point` OBJECT, which the parent rebuilds on every
 *    render, so the effect re-fired constantly and fought the user's panning.
 *    Depending on the lat/lng NUMBERS means it fires only on a real move.
 */
function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [map, lat, lng, zoom]);
  return null;
}

function ClickToPlace({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export interface AddressPickerMapProps {
  point: LatLng | null;
  /** Where to sit when no point is picked: the selected settlement's centre,
   *  else its parent city's, else the region. */
  fallbackCenter: LatLng;
  /** Zoom for `fallbackCenter` — tighter for a settlement than for a city. */
  fallbackZoom?: number;
  onPick: (p: LatLng) => void;
  disabled?: boolean;
}

export default function AddressPickerMap({
  point,
  fallbackCenter,
  fallbackZoom = 12,
  onPick,
  disabled = false,
}: AddressPickerMapProps) {
  /**
   * ⚠ ONE-FINGER DRAG MUST SCROLL THE PAGE, NOT PAN THE MAP.
   * On a phone a full-width map that captures touch-drag traps the reader: the
   * page stops scrolling and the form below becomes unreachable. So map
   * dragging is disabled on touch devices, while pinch-zoom stays on and the
   * MARKER remains draggable (marker drag works independently of map drag), and
   * a tap still places the point. On a mouse, dragging behaves normally.
   */
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(
      typeof window !== "undefined" &&
        window.matchMedia("(hover: none) and (pointer: coarse)").matches,
    );
  }, []);

  const markerIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        // Brand blue with a white ring — same visual language as the CRM map.
        html:
          '<span style="display:block;width:18px;height:18px;border-radius:9999px;' +
          'background:#1A5FE0;border:3px solid #ffffff;' +
          'box-shadow:0 1px 6px rgba(15,23,42,0.45)"></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    [],
  );

  const center = point ?? fallbackCenter;
  const zoom = point ? 17 : fallbackZoom;

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      scrollWheelZoom={false}
      dragging={!isTouch}
      touchZoom
      attributionControl={false}
      className="h-full w-full"
    >
      <AttributionControl position="bottomright" prefix={false} />
      <MapUnmountGuard />
      <TileLayer
        attribution={OSM_TILE_ATTRIBUTION}
        url={OSM_TILE_URL}
        maxZoom={OSM_MAX_ZOOM}
      />
      {point ? (
        <Marker
          position={[point.lat, point.lng]}
          icon={markerIcon}
          draggable={!disabled}
          eventHandlers={{
            dragend(e) {
              const ll = (e.target as L.Marker).getLatLng();
              onPick({ lat: ll.lat, lng: ll.lng });
            },
          }}
        />
      ) : null}
      {/* Keyed on numbers, and driven by the RESOLVED target so that selecting a
          city or settlement moves the map even before a point exists. */}
      <Recenter lat={center.lat} lng={center.lng} zoom={zoom} />
      {disabled ? null : <ClickToPlace onPick={onPick} />}
    </MapContainer>
  );
}
