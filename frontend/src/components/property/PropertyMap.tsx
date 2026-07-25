"use client";

import { useMemo } from "react";
import L from "leaflet";
import { AttributionControl, MapContainer, Marker, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface PropertyMapProps {
  latitude: number;
  longitude: number;
  showMap: boolean;
}

export function PropertyMap({ latitude, longitude, showMap }: PropertyMapProps) {
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
      <div className="mt-6">
        <h2 className="text-xl font-semibold text-gray-900">Расположение</h2>
        <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
          Координаты объекта не указаны — карта недоступна.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold text-gray-900">Расположение</h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
        <MapContainer
          center={[latitude, longitude]}
          zoom={14}
          scrollWheelZoom={false}
          attributionControl={false}
          className="h-[320px] w-full"
        >
          <AttributionControl position="bottomright" prefix={false} />
          <TileLayer
            attribution="&copy; 2GIS"
            url="https://tile2.maps.2gis.com/tiles?x={x}&y={y}&z={z}&v=1"
          />
          <Marker position={[latitude, longitude]} icon={markerIcon} />
        </MapContainer>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Точка на карте указана приблизительно.
      </p>
    </div>
  );
}
