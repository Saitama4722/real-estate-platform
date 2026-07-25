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

  const center = useMemo<[number, number]>(() => {
    if (withCoords.length === 0) {
      return [45.03547, 38.97531];
    }

    const lat = withCoords.reduce((acc, item) => acc + item.latitude, 0) / withCoords.length;
    const lng = withCoords.reduce((acc, item) => acc + item.longitude, 0) / withCoords.length;
    return [lat, lng];
  }, [withCoords]);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <MapContainer
        center={center}
        zoom={11}
        scrollWheelZoom
        attributionControl={false}
        className="h-[440px] w-full"
      >
        <AttributionControl position="bottomright" prefix={false} />
        <TileLayer
          attribution="&copy; 2GIS"
          url="https://tile2.maps.2gis.com/tiles?x={x}&y={y}&z={z}&v=1"
        />

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
    </div>
  );
}
