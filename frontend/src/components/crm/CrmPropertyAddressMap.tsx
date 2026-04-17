"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Input } from "@/components/ui/input";

type YmapsApi = {
  ready: (cb: () => void) => void;
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

function hasValidCoords(latStr: string, lngStr: string): boolean {
  const la = parseFloat(latStr.replace(",", "."));
  const lo = parseFloat(lngStr.replace(",", "."));
  return Number.isFinite(la) && Number.isFinite(lo);
}

/** Краснодар — стартовый центр карты до выбора точки. */
const DEFAULT_MAP_CENTER: [number, number] = [45.0355, 38.9753];

interface CrmPropertyAddressMapProps {
  addressText: string;
  onAddressTextChange: (v: string) => void;
  latitudeStr: string;
  longitudeStr: string;
  onLatitudeChange: (v: string) => void;
  onLongitudeChange: (v: string) => void;
}

export function CrmPropertyAddressMap({
  addressText,
  onAddressTextChange,
  latitudeStr,
  longitudeStr,
  onLatitudeChange,
  onLongitudeChange,
}: CrmPropertyAddressMapProps) {
  const apiKey = (process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "").trim();
  const [ymapsStatus, setYmapsStatus] = useState<"off" | "loading" | "ready" | "error">(
    apiKey ? "loading" : "off",
  );
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!apiKey) {
      setYmapsStatus("off");
      return;
    }
    let cancelled = false;
    if (window.ymaps) {
      window.ymaps.ready(() => {
        if (!cancelled) setYmapsStatus("ready");
      });
      return () => {
        cancelled = true;
      };
    }
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      if (cancelled) return;
      const y = window.ymaps;
      if (!y) {
        setYmapsStatus("error");
        return;
      }
      y.ready(() => {
        if (!cancelled) setYmapsStatus("ready");
      });
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

  const runSuggest = useCallback(
    (text: string) => {
      if (ymapsStatus !== "ready" || !window.ymaps) {
        setSuggestions([]);
        return;
      }
      const q = text.trim();
      if (q.length < 3) {
        setSuggestions([]);
        return;
      }
      void window.ymaps
        .suggest(q, { results: 6 })
        .then((items) => {
          const labels = items.map((it) => it.value).filter(Boolean);
          setSuggestions(labels);
          setSuggestOpen(labels.length > 0);
        })
        .catch(() => {
          setSuggestions([]);
        });
    },
    [ymapsStatus],
  );

  const onAddressInput = (v: string) => {
    onAddressTextChange(v);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => runSuggest(v), 320);
  };

  const pickSuggestion = async (label: string) => {
    setSuggestOpen(false);
    onAddressTextChange(label);
    setSuggestions([]);
    if (ymapsStatus !== "ready" || !window.ymaps) return;
    try {
      const res = await window.ymaps.geocode(label);
      const first = res.geoObjects.get(0);
      if (!first) return;
      const [lon, lat] = first.geometry.getCoordinates();
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        onLatitudeChange(lat.toFixed(6));
        onLongitudeChange(lon.toFixed(6));
      }
    } catch {
      /* геокодер недоступен — остаются ручные координаты */
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
          {apiKey && ymapsStatus === "loading" && (
            <p className="mt-1 text-xs text-gray-500">Загрузка подсказок…</p>
          )}
          {apiKey && ymapsStatus === "error" && (
            <p className="mt-1 text-xs text-amber-700">
              Не удалось загрузить подсказки Яндекса — укажите адрес текстом и поставьте метку на карте
              ниже.
            </p>
          )}
          {!apiKey && (
            <p className="mt-1 text-xs text-gray-500">
              Подсказки по адресу: задайте переменную окружения{" "}
              <code className="rounded bg-gray-100 px-1">NEXT_PUBLIC_YANDEX_MAPS_API_KEY</code>{" "}
              (как на публичном сайте). Без ключа можно ввести адрес и указать точку на карте кликом.
            </p>
          )}
          {suggestOpen && suggestions.length > 0 && (
            <ul
              className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg"
              role="listbox"
            >
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-gray-50"
                    onClick={() => void pickSuggestion(s)}
                  >
                    {s}
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
            key={hasMarker ? `${latitudeStr}-${longitudeStr}` : "no-marker"}
            center={center}
            zoom={zoom}
            scrollWheelZoom={false}
            className="h-[240px] w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {hasMarker ? <Marker position={[latNum, lngNum]} icon={markerIcon} /> : null}
            <MapClickHandler onPick={onMapPick} />
          </MapContainer>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Плитки карты — OpenStreetMap (как на карточке объекта на сайте). Подсказки адреса — Яндекс
          при наличии ключа.
        </p>
      </div>
    </div>
  );
}
