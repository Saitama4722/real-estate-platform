"use client";

import Link from "next/link";
import { useMemo } from "react";
import L from "leaflet";
import { AttributionControl, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import { CatalogPropertyItem } from "@/components/catalog/types";
import { hasCatalogItemMapCoords } from "@/lib/mapCoordinates";
import {
  OSM_MAX_ZOOM,
  OSM_TILE_ATTRIBUTION,
  OSM_TILE_URL,
} from "@/components/address/addressMapConstants";
import { FitToMarkers, serviceAreaBounds } from "@/components/map/FitToMarkers";
import { MapUnmountGuard } from "@/components/map/MapUnmountGuard";

interface CatalogMapProps {
  properties: CatalogPropertyItem[];
}

export function CatalogMap({ properties }: CatalogMapProps) {
  const withCoords = useMemo(
    () => properties.filter(hasCatalogItemMapCoords),
    [properties],
  );

  const markerIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: '<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#2563eb;border:2px solid #ffffff;box-shadow:0 1px 4px rgba(15,23,42,0.35)"></span>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    [],
  );

  const points = useMemo(
    () => withCoords.map((p) => ({ lat: p.latitude, lng: p.longitude })),
    [withCoords],
  );

  /**
   * Mount-time view only — `FitToMarkers` takes over immediately and frames the
   * markers. It stays the centroid so the first paint is somewhere sensible if
   * a tile arrives before the fit runs; the ZOOM 11 that used to ship with it is
   * what hid every marker when the listings span ~100 km.
   */
  const center = useMemo<[number, number]>(() => {
    if (withCoords.length === 0) {
      const c = serviceAreaBounds().getCenter();
      return [c.lat, c.lng];
    }
    const lat = withCoords.reduce((acc, item) => acc + item.latitude, 0) / withCoords.length;
    const lng = withCoords.reduce((acc, item) => acc + item.longitude, 0) / withCoords.length;
    return [lat, lng];
  }, [withCoords]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200">
      <MapContainer
        center={center}
        zoom={11}
        scrollWheelZoom
        attributionControl={false}
        className="h-[440px] w-full"
      >
        <AttributionControl position="bottomright" prefix={false} />
        <TileLayer
          attribution={OSM_TILE_ATTRIBUTION}
          url={OSM_TILE_URL}
          maxZoom={OSM_MAX_ZOOM}
        />
        <FitToMarkers points={points} />
        <MapUnmountGuard />

        <MarkerClusterGroup
          chunkedLoading
          chunkInterval={200}
          chunkDelay={50}
          maxClusterRadius={64}
          showCoverageOnHover={false}
        >
          {withCoords.map((property) => (
            <Marker
              key={property.id}
              position={[property.latitude, property.longitude]}
              icon={markerIcon}
            >
              <Popup>
                <div className="min-w-52">
                  <p className="text-sm font-semibold text-gray-900">{property.title}</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{property.price}</p>
                  <p className="mt-1 text-xs text-gray-600">{property.location}</p>
                  <Link
                    href={property.href}
                    className="mt-3 inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white! hover:bg-blue-700"
                  >
                    Открыть объект
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
      {/* Defensive: both callers already replace the map with their own empty
          state, so this is not normally reachable. If it ever is, the reader
          gets the service-area view AND a reason, never a blank map. */}
      {withCoords.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center px-3">
          <span className="rounded-full bg-surface-raised/95 px-3.5 py-1.5 text-xs text-fg-secondary shadow-sm">
            По текущим фильтрам нет объектов для показа на карте
          </span>
        </div>
      )}
    </div>
  );
}
