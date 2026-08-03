"use client";

import { useMemo } from "react";
import L from "leaflet";
import { AttributionControl, MapContainer, Marker, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Info } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { PropertySection } from "@/components/property/PropertySection";

interface PropertyMapProps {
  latitude: number;
  longitude: number;
  showMap: boolean;
  /** City / district shown on the right of the section title. */
  locationLabel?: string;
}

export function PropertyMap({
  latitude,
  longitude,
  showMap,
  locationLabel,
}: PropertyMapProps) {
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

  if (!showMap) {
    return (
      <PropertySection title="Расположение">
        <div className="rounded-xl border border-dashed border-border-strong bg-surface px-4 py-8 text-center text-sm text-fg-muted">
          Координаты объекта не указаны — карта недоступна.
        </div>
      </PropertySection>
    );
  }

  return (
    <PropertySection
      title="Расположение"
      aside={
        locationLabel ? (
          <span className="text-sm text-fg-secondary">{locationLabel}</span>
        ) : undefined
      }
    >
      {/* Rounded clip lives on this wrapper, not the section: Leaflet paints
          tiles into its own panes and would square off the corners otherwise. */}
      <div className="overflow-hidden rounded-xl">
        <MapContainer
          center={[latitude, longitude]}
          zoom={14}
          scrollWheelZoom={false}
          attributionControl={false}
          className="h-[210px] w-full md:h-[300px]"
        >
          <AttributionControl position="bottomright" prefix={false} />
          <TileLayer
            attribution="&copy; 2GIS"
            url="https://tile2.maps.2gis.com/tiles?x={x}&y={y}&z={z}&v=1"
          />
          <Marker position={[latitude, longitude]} icon={markerIcon} />
        </MapContainer>
      </div>
      <p className="mt-3 flex items-center gap-2 text-[12.5px] text-fg-muted">
        <Icon icon={Info} className="size-[15px] shrink-0" />
        Точка на карте указана приблизительно
      </p>
    </PropertySection>
  );
}
