"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";

type YmapsApi = {
  ready: (modulesOrCb: string[] | (() => void), cb?: () => void) => void;
  suggest: (
    query: string,
    opts?: { results?: number },
  ) => Promise<Array<{ value: string }>>;
  geocode: (query: string) => Promise<{
    geoObjects: {
      get: (index: number) => {
        geometry: { getCoordinates: () => [number, number] };
      };
    };
  }>;
};

declare global {
  interface Window {
    ymaps?: YmapsApi;
  }
}

function MapClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * react-leaflet ignores changes to <MapContainer center/zoom> after the initial
 * mount (the Leaflet map is imperative). To re-center when coordinates change —
 * e.g. after picking a 2GIS suggestion — call map.setView() imperatively.
 */
function RecenterMap({
  lat,
  lng,
  zoom,
}: {
  lat: number;
  lng: number;
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [map, lat, lng, zoom]);
  return null;
}

function hasValidCoords(latStr: string, lngStr: string): boolean {
  const la = parseFloat(latStr.replace(",", "."));
  const lo = parseFloat(lngStr.replace(",", "."));
  return Number.isFinite(la) && Number.isFinite(lo);
}

/** Краснодар — стартовый центр карты до выбора точки. */
const DEFAULT_MAP_CENTER: [number, number] = [45.0355, 38.9753];

/** Смещение подсказок 2ГИС к Краснодару (формат запроса: lon,lat). */
const SUGGEST_LOCATION = "38.9769,45.0448";

type AddressSuggestion = {
  label: string;
  lat: number | null;
  lon: number | null;
};

interface CrmPropertyAddressMapProps {
  addressText?: string;
  onAddressTextChange?: (v: string) => void;
  latitudeStr: string;
  longitudeStr: string;
  onLatitudeChange: (v: string) => void;
  onLongitudeChange: (v: string) => void;
}

export function CrmPropertyAddressMap({
  addressText: addressTextProp = "",
  onAddressTextChange,
  latitudeStr,
  longitudeStr,
  onLatitudeChange,
  onLongitudeChange,
}: CrmPropertyAddressMapProps) {
  // The parent form may or may not own the address-text state. When it does not
  // pass addressText/onAddressTextChange, fall back to local state so the field
  // and Yandex suggestions still work.
  const [localAddressText, setLocalAddressText] = useState(addressTextProp);
  const addressText = onAddressTextChange ? addressTextProp : localAddressText;
  const handleAddressTextChange = onAddressTextChange ?? setLocalAddressText;
  const apiKey = (process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "").trim();
  const gisKey = (process.env.NEXT_PUBLIC_2GIS_API_KEY ?? "").trim();
  const [ymapsStatus, setYmapsStatus] = useState<"off" | "loading" | "ready" | "error">(
    apiKey ? "loading" : "off",
  );
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log(
      "[CrmPropertyAddressMap] NEXT_PUBLIC_YANDEX_MAPS_API_KEY length:",
      (process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "").length,
    );
  }, []);

  useEffect(() => {
    console.log("[CrmPropertyAddressMap] ymapsStatus changed:", ymapsStatus);
  }, [ymapsStatus]);

  useEffect(() => {
    if (!apiKey) {
      setYmapsStatus("off");
      return;
    }
    let cancelled = false;

    const markReady = () => {
      window.ymaps?.ready(["suggest", "geocode"], () => {
        if (!cancelled) setYmapsStatus("ready");
      });
    };

    // 1) API already fully loaded (e.g. another instance / a remount) — reuse it.
    if (window.ymaps) {
      markReady();
      return () => {
        cancelled = true;
      };
    }

    // 2) A load is already in flight: a script tag exists in the DOM but
    //    window.ymaps is not populated yet. Attach to that tag instead of
    //    appending a second one — loading the API twice triggers
    //    "Yandex Maps JS API is already enabled on this page with same namespace".
    const existing = document.getElementById(
      "ymaps-script",
    ) as HTMLScriptElement | null;
    if (existing) {
      const onLoad = () => {
        if (!cancelled) markReady();
      };
      const onError = () => {
        if (!cancelled) setYmapsStatus("error");
      };
      // If it already finished loading between the checks above, ymaps is set.
      if (window.ymaps) {
        markReady();
      } else {
        existing.addEventListener("load", onLoad);
        existing.addEventListener("error", onError);
      }
      return () => {
        cancelled = true;
        existing.removeEventListener("load", onLoad);
        existing.removeEventListener("error", onError);
      };
    }

    // 3) First loader on the page — create the single shared script tag.
    const script = document.createElement("script");
    script.id = "ymaps-script";
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU&load=package.full`;
    script.async = true;
    script.onload = () => {
      if (cancelled) return;
      if (!window.ymaps) {
        setYmapsStatus("error");
        return;
      }
      markReady();
    };
    script.onerror = () => {
      if (!cancelled) setYmapsStatus("error");
    };
    document.head.appendChild(script);
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  // Address suggestions come from the 2GIS Suggest API (plain HTTP GET, no SDK).
  // Each suggestion already carries coordinates, so picking one needs no extra
  // geocoding step.
  const runSuggest = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!gisKey || q.length < 3) {
        setSuggestions([]);
        return;
      }
      const url =
        `https://catalog.api.2gis.com/3.0/suggests?q=${encodeURIComponent(q)}` +
        `&suggest_type=address&fields=items.point` +
        `&location=${SUGGEST_LOCATION}&key=${encodeURIComponent(gisKey)}`;
      void fetch(url)
        .then((res) => res.json())
        .then((data) => {
          const items: Array<{
            full_name?: string;
            point?: { lat?: number; lon?: number };
          }> = data?.result?.items ?? [];
          const parsed: AddressSuggestion[] = items
            .filter((it) => Boolean(it.full_name))
            .map((it) => ({
              label: it.full_name as string,
              lat: typeof it.point?.lat === "number" ? it.point.lat : null,
              lon: typeof it.point?.lon === "number" ? it.point.lon : null,
            }));
          setSuggestions(parsed);
          setSuggestOpen(parsed.length > 0);
        })
        .catch(() => {
          setSuggestions([]);
        });
    },
    [gisKey],
  );

  const onAddressInput = (v: string) => {
    handleAddressTextChange(v);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => runSuggest(v), 300);
  };

  const pickSuggestion = (suggestion: AddressSuggestion) => {
    setSuggestOpen(false);
    handleAddressTextChange(suggestion.label);
    setSuggestions([]);
    // 2GIS already returns coordinates with the suggestion — set them directly.
    // Updating lat/lng re-centers the map and moves the marker (see `center` /
    // `MapContainer key` below).
    if (
      suggestion.lat != null &&
      suggestion.lon != null &&
      Number.isFinite(suggestion.lat) &&
      Number.isFinite(suggestion.lon)
    ) {
      onLatitudeChange(suggestion.lat.toFixed(6));
      onLongitudeChange(suggestion.lon.toFixed(6));
    }
  };

  const markerIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: '<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#2563eb;border:2px solid #ffffff;box-shadow:0 1px 4px rgba(15,23,42,0.35)"></span>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
    [],
  );

  const hasMarker = hasValidCoords(latitudeStr, longitudeStr);
  const latNum = parseFloat(latitudeStr.replace(",", "."));
  const lngNum = parseFloat(longitudeStr.replace(",", "."));
  const center: [number, number] = hasMarker ? [latNum, lngNum] : DEFAULT_MAP_CENTER;
  const zoom = hasMarker ? 15 : 12;

  const onMapPick = (lat: number, lng: number) => {
    onLatitudeChange(lat.toFixed(6));
    onLongitudeChange(lng.toFixed(6));
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Адрес (текст)
        </label>
        <div ref={wrapRef} className="relative">
          <Input
            value={addressText}
            onChange={(e) => onAddressInput(e.target.value)}
            placeholder="Начните вводить адрес"
            autoComplete="off"
          />
          {!gisKey && (
            <p className="mt-1 text-xs text-gray-500">
              Подсказки по адресу: задайте переменную окружения{" "}
              <code className="rounded bg-gray-100 px-1">NEXT_PUBLIC_2GIS_API_KEY</code>. Без ключа
              можно ввести адрес и указать точку на карте кликом.
            </p>
          )}
          {suggestOpen && suggestions.length > 0 && (
            // z-[1000] MUST use the arbitrary-value form: Tailwind v4's default
            // z-index scale stops at z-50, so a bare `z-1000` is NOT a real
            // utility and compiles to nothing (leaving this panel un-raised, so
            // it renders under the Leaflet map and page content bleeds through).
            // Do NOT let an editor "canonicalize" this back to `z-1000`. 1000+ is
            // required per the Leaflet-overlay rule in CLAUDE.md.
            <ul
              className="absolute left-0 top-full z-[1000] mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm text-gray-900 shadow-lg"
              role="listbox"
            >
              {suggestions.map((s, i) => (
                <li key={`${s.label}-${i}`}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-gray-900 hover:bg-gray-50"
                    onClick={() => pickSuggestion(s)}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Точка на карте</p>
        <p className="mb-2 text-xs text-gray-600">
          Кликните по карте, чтобы поставить метку, или выберите адрес из подсказки — координаты
          сохранятся автоматически.
        </p>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <MapContainer
            center={center}
            zoom={zoom}
            scrollWheelZoom={false}
            attributionControl={false}
            className="h-[240px] w-full"
          >
            <AttributionControl position="bottomright" prefix={false} />
            <TileLayer
              attribution="&copy; 2GIS"
              url="https://tile2.maps.2gis.com/tiles?x={x}&y={y}&z={z}&v=1"
            />
            {hasMarker ? <Marker position={[latNum, lngNum]} icon={markerIcon} /> : null}
            {hasMarker ? <RecenterMap lat={latNum} lng={lngNum} zoom={zoom} /> : null}
            <MapClickHandler onPick={onMapPick} />
          </MapContainer>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Плитки карты — 2ГИС. Подсказки адреса — 2ГИС при наличии ключа.
        </p>
      </div>
    </div>
  );
}
