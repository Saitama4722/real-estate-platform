"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type PropertyType = "apartment" | "house" | "land" | "commercial";

type RoomsSelectValue = "" | "0" | "1" | "2" | "3" | "4" | "4plus";

interface CityRow {
  id: number;
  name: string;
  slug: string;
}

interface DistrictRow {
  id: number;
  name: string;
  slug: string;
  city: { id: number; name: string; slug: string };
}

interface ChoiceEntry {
  value: string;
  label: string;
}

function coercePropertyType(raw: string | undefined): PropertyType {
  if (raw && (raw === "apartment" || raw === "house" || raw === "land" || raw === "commercial")) {
    return raw;
  }
  return "apartment";
}

function roomsSelectFromInitial(
  initialRooms?: string,
  initialRoomsMin?: string,
): RoomsSelectValue {
  const r = initialRooms?.trim();
  if (r === "0" || r === "1" || r === "2" || r === "3" || r === "4") return r;
  const rm = initialRoomsMin?.trim();
  if (rm === "4") return "4plus";
  return "";
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function normalizeDecimalInput(raw: string): string | undefined {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return String(n);
}

interface BuildQueryInput {
  propertyType: PropertyType;
  citySlug: string;
  districtSlug: string;
  search: string;
  rooms: RoomsSelectValue;
  marketType: string;
  priceMin: string;
  priceMax: string;
  houseAreaMin: string;
  houseAreaMax: string;
  houseLandAreaMin: string;
  houseLandAreaMax: string;
  landAreaMin: string;
  landAreaMax: string;
  commercialType: string;
  commercialAreaMin: string;
  commercialAreaMax: string;
  view?: "map";
}

function buildCatalogQuery(p: BuildQueryInput): string {
  const q = new URLSearchParams();
  q.set("property_type", p.propertyType);

  const search = p.search.trim();
  if (search) q.set("search", search);

  if (p.citySlug) q.set("city_slug", p.citySlug);
  if (p.districtSlug) q.set("district_slug", p.districtSlug);

  const pMin = normalizeDecimalInput(p.priceMin);
  const pMax = normalizeDecimalInput(p.priceMax);
  if (pMin) q.set("price_min", pMin);
  if (pMax) q.set("price_max", pMax);

  if (p.propertyType === "apartment") {
    if (p.rooms === "4plus") q.set("rooms_min", "4");
    else if (p.rooms !== "") q.set("rooms", p.rooms);
    if (p.marketType === "new_building" || p.marketType === "secondary" || p.marketType === "other") {
      q.set("market_type", p.marketType);
    }
  }

  if (p.propertyType === "house") {
    const a = normalizeDecimalInput(p.houseAreaMin);
    const b = normalizeDecimalInput(p.houseAreaMax);
    if (a) q.set("house_area_min", a);
    if (b) q.set("house_area_max", b);
    const la = normalizeDecimalInput(p.houseLandAreaMin);
    const lb = normalizeDecimalInput(p.houseLandAreaMax);
    if (la) q.set("house_land_area_min", la);
    if (lb) q.set("house_land_area_max", lb);
  }

  if (p.propertyType === "land") {
    const a = normalizeDecimalInput(p.landAreaMin);
    const b = normalizeDecimalInput(p.landAreaMax);
    if (a) q.set("land_area_min", a);
    if (b) q.set("land_area_max", b);
  }

  if (p.propertyType === "commercial") {
    if (p.commercialType) q.set("commercial_type", p.commercialType);
    const a = normalizeDecimalInput(p.commercialAreaMin);
    const b = normalizeDecimalInput(p.commercialAreaMax);
    if (a) q.set("commercial_area_min", a);
    if (b) q.set("commercial_area_max", b);
  }

  if (p.view) q.set("view", p.view);
  return q.toString();
}

export type SearchBarVariant = "hero" | "catalog";

export interface SearchBarProps {
  variant: SearchBarVariant;
  initialPropertyType?: string;
  initialCitySlug?: string;
  initialDistrictSlug?: string;
  initialRooms?: string;
  initialRoomsMin?: string;
  initialSearch?: string;
  initialMarketType?: string;
  initialPriceMin?: string;
  initialPriceMax?: string;
  initialHouseAreaMin?: string;
  initialHouseAreaMax?: string;
  initialHouseLandAreaMin?: string;
  initialHouseLandAreaMax?: string;
  initialLandAreaMin?: string;
  initialLandAreaMax?: string;
  initialCommercialType?: string;
  initialCommercialAreaMin?: string;
  initialCommercialAreaMax?: string;
}

export function SearchBar({
  variant,
  initialPropertyType,
  initialCitySlug,
  initialDistrictSlug,
  initialRooms,
  initialRoomsMin,
  initialSearch,
  initialMarketType,
  initialPriceMin,
  initialPriceMax,
  initialHouseAreaMin,
  initialHouseAreaMax,
  initialHouseLandAreaMin,
  initialHouseLandAreaMax,
  initialLandAreaMin,
  initialLandAreaMax,
  initialCommercialType,
  initialCommercialAreaMin,
  initialCommercialAreaMax,
}: SearchBarProps) {
  const router = useRouter();

  const fromCatalog = variant === "catalog";

  const [propertyType, setPropertyType] = useState<PropertyType>(() =>
    fromCatalog ? coercePropertyType(initialPropertyType) : "apartment",
  );
  const [citySlug, setCitySlug] = useState(() =>
    fromCatalog ? (initialCitySlug ?? "").trim() : "",
  );
  const [districtSlug, setDistrictSlug] = useState(() =>
    fromCatalog ? (initialDistrictSlug ?? "").trim() : "",
  );
  const [rooms, setRooms] = useState<RoomsSelectValue>(() =>
    fromCatalog ? roomsSelectFromInitial(initialRooms, initialRoomsMin) : "",
  );
  const [marketType, setMarketType] = useState(() =>
    fromCatalog ? (initialMarketType ?? "").trim() : "",
  );
  const [search, setSearch] = useState(() =>
    fromCatalog ? (initialSearch ?? "") : "",
  );
  const [priceMin, setPriceMin] = useState(() =>
    fromCatalog ? (initialPriceMin ?? "") : "",
  );
  const [priceMax, setPriceMax] = useState(() =>
    fromCatalog ? (initialPriceMax ?? "") : "",
  );
  const [houseAreaMin, setHouseAreaMin] = useState(() =>
    fromCatalog ? (initialHouseAreaMin ?? "") : "",
  );
  const [houseAreaMax, setHouseAreaMax] = useState(() =>
    fromCatalog ? (initialHouseAreaMax ?? "") : "",
  );
  const [houseLandAreaMin, setHouseLandAreaMin] = useState(() =>
    fromCatalog ? (initialHouseLandAreaMin ?? "") : "",
  );
  const [houseLandAreaMax, setHouseLandAreaMax] = useState(() =>
    fromCatalog ? (initialHouseLandAreaMax ?? "") : "",
  );
  const [landAreaMin, setLandAreaMin] = useState(() =>
    fromCatalog ? (initialLandAreaMin ?? "") : "",
  );
  const [landAreaMax, setLandAreaMax] = useState(() =>
    fromCatalog ? (initialLandAreaMax ?? "") : "",
  );
  const [commercialType, setCommercialType] = useState(() =>
    fromCatalog ? (initialCommercialType ?? "").trim() : "",
  );
  const [commercialAreaMin, setCommercialAreaMin] = useState(() =>
    fromCatalog ? (initialCommercialAreaMin ?? "") : "",
  );
  const [commercialAreaMax, setCommercialAreaMax] = useState(() =>
    fromCatalog ? (initialCommercialAreaMax ?? "") : "",
  );

  const [cities, setCities] = useState<CityRow[]>([]);
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [commercialChoices, setCommercialChoices] = useState<ChoiceEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetchJson<CityRow[] | { results: CityRow[] }>(
        "/api/locations/cities/",
      );
      if (cancelled) return;
      const rows = Array.isArray(list) ? list : list?.results;
      setCities(Array.isArray(rows) ? rows : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCityId = useMemo(() => {
    if (!citySlug) return null;
    return cities.find((c) => c.slug === citySlug)?.id ?? null;
  }, [cities, citySlug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const qs = selectedCityId != null ? `?city=${selectedCityId}` : "";
      const list = await fetchJson<DistrictRow[] | { results: DistrictRow[] }>(
        `/api/locations/districts/${qs}`,
      );
      if (cancelled) return;
      const rows = Array.isArray(list) ? list : list?.results;
      setDistricts(Array.isArray(rows) ? rows : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCityId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchJson<{ commercial_types?: ChoiceEntry[] }>(
        "/api/locations/choices/",
      );
      if (cancelled) return;
      setCommercialChoices(
        Array.isArray(data?.commercial_types) ? data!.commercial_types! : [],
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const queryPayload = useCallback(
    (view?: "map"): BuildQueryInput => ({
      propertyType,
      citySlug,
      districtSlug,
      search,
      rooms,
      marketType,
      priceMin,
      priceMax,
      houseAreaMin,
      houseAreaMax,
      houseLandAreaMin,
      houseLandAreaMax,
      landAreaMin,
      landAreaMax,
      commercialType,
      commercialAreaMin,
      commercialAreaMax,
      view,
    }),
    [
      propertyType,
      citySlug,
      districtSlug,
      search,
      rooms,
      marketType,
      priceMin,
      priceMax,
      houseAreaMin,
      houseAreaMax,
      houseLandAreaMin,
      houseLandAreaMax,
      landAreaMin,
      landAreaMax,
      commercialType,
      commercialAreaMin,
      commercialAreaMax,
    ],
  );

  const applySearch = (view?: "map") => {
    const qs = buildCatalogQuery(queryPayload(view));
    router.push(`/catalog?${qs}`);
  };

  const scrollToHomeMap = () => {
    document.getElementById("home-map")?.scrollIntoView({ behavior: "smooth" });
  };

  const onCityChange = (slug: string) => {
    setCitySlug(slug);
    setDistrictSlug("");
  };

  const onPropertyTypeChange = (next: PropertyType) => {
    setPropertyType(next);
    if (next !== "apartment") {
      setRooms("");
      setMarketType("");
    }
  };

  return (
    <div className="rounded-2xl bg-white/95 p-3 shadow-lg shadow-black/20 backdrop-blur-sm md:p-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
        <Button size="sm" className="h-9">
          Продажа
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9"
          disabled
          title="Аренда недоступна в текущем MVP"
          type="button"
        >
          Аренда
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-3">
          <label className="mb-1 block text-xs font-medium text-gray-600">Тип недвижимости</label>
          <Select
            aria-label="Тип недвижимости"
            value={propertyType}
            onChange={(event) => onPropertyTypeChange(event.target.value as PropertyType)}
            className="h-11 w-full md:h-12"
          >
            <option value="apartment">Квартиры</option>
            <option value="house">Дома</option>
            <option value="land">Участки</option>
            <option value="commercial">Коммерческая</option>
          </Select>
        </div>

        <div className="md:col-span-3">
          <label className="mb-1 block text-xs font-medium text-gray-600">Город</label>
          <Select
            aria-label="Город"
            value={citySlug}
            onChange={(e) => onCityChange(e.target.value)}
            className="h-11 w-full md:h-12"
          >
            <option value="">Все города</option>
            {cities.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="md:col-span-3">
          <label className="mb-1 block text-xs font-medium text-gray-600">Район</label>
          <Select
            aria-label="Район"
            value={districtSlug}
            onChange={(e) => setDistrictSlug(e.target.value)}
            className="h-11 w-full md:h-12"
          >
            <option value="">Все районы</option>
            {districts.map((d) => (
              <option key={d.id} value={d.slug}>
                {!citySlug && d.city?.name ? `${d.name} — ${d.city.name}` : d.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="md:col-span-3">
          <label className="mb-1 block text-xs font-medium text-gray-600">Цена, ₽</label>
          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="decimal"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              placeholder="от"
              aria-label="Цена от"
              className="h-11 md:h-12"
            />
            <Input
              type="text"
              inputMode="decimal"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              placeholder="до"
              aria-label="Цена до"
              className="h-11 md:h-12"
            />
          </div>
        </div>

        {propertyType === "apartment" && (
          <>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Комнат</label>
              <Select
                aria-label="Количество комнат"
                value={rooms}
                onChange={(e) => setRooms(e.target.value as RoomsSelectValue)}
                className="h-11 w-full md:h-12"
              >
                <option value="">Любое</option>
                <option value="0">Студия</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="4plus">4 и более</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Рынок</label>
              <Select
                aria-label="Сегмент рынка"
                value={marketType}
                onChange={(e) => setMarketType(e.target.value)}
                className="h-11 w-full md:h-12"
              >
                <option value="">Любой</option>
                <option value="secondary">Вторичка</option>
                <option value="new_building">Новостройка</option>
                <option value="other">Иное</option>
              </Select>
            </div>
            <div className="md:col-span-8">
              <label className="mb-1 block text-xs font-medium text-gray-600">Поиск по тексту</label>
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Адрес, улица или ключевые слова"
                aria-label="Поиск по тексту объявлений"
                className="h-11 md:h-12"
              />
            </div>
          </>
        )}

        {propertyType === "house" && (
          <>
            <div className="md:col-span-3">
              <label className="mb-1 block text-xs font-medium text-gray-600">Площадь дома, м²</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={houseAreaMin}
                  onChange={(e) => setHouseAreaMin(e.target.value)}
                  placeholder="от"
                  aria-label="Площадь дома от"
                  className="h-11 md:h-12"
                />
                <Input
                  type="text"
                  inputMode="decimal"
                  value={houseAreaMax}
                  onChange={(e) => setHouseAreaMax(e.target.value)}
                  placeholder="до"
                  aria-label="Площадь дома до"
                  className="h-11 md:h-12"
                />
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-xs font-medium text-gray-600">Площадь участка, сот.</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={houseLandAreaMin}
                  onChange={(e) => setHouseLandAreaMin(e.target.value)}
                  placeholder="от"
                  aria-label="Площадь участка от"
                  className="h-11 md:h-12"
                />
                <Input
                  type="text"
                  inputMode="decimal"
                  value={houseLandAreaMax}
                  onChange={(e) => setHouseLandAreaMax(e.target.value)}
                  placeholder="до"
                  aria-label="Площадь участка до"
                  className="h-11 md:h-12"
                />
              </div>
            </div>
            <div className="md:col-span-6">
              <label className="mb-1 block text-xs font-medium text-gray-600">Поиск по тексту</label>
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Район, населённый пункт или ключевые слова"
                aria-label="Поиск по тексту объявлений"
                className="h-11 md:h-12"
              />
            </div>
          </>
        )}

        {propertyType === "land" && (
          <>
            <div className="md:col-span-3">
              <label className="mb-1 block text-xs font-medium text-gray-600">Площадь участка, сот.</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={landAreaMin}
                  onChange={(e) => setLandAreaMin(e.target.value)}
                  placeholder="от"
                  aria-label="Площадь участка от"
                  className="h-11 md:h-12"
                />
                <Input
                  type="text"
                  inputMode="decimal"
                  value={landAreaMax}
                  onChange={(e) => setLandAreaMax(e.target.value)}
                  placeholder="до"
                  aria-label="Площадь участка до"
                  className="h-11 md:h-12"
                />
              </div>
            </div>
            <div className="md:col-span-9">
              <label className="mb-1 block text-xs font-medium text-gray-600">Поиск по тексту</label>
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Район, СНТ или ключевые слова"
                aria-label="Поиск по тексту объявлений"
                className="h-11 md:h-12"
              />
            </div>
          </>
        )}

        {propertyType === "commercial" && (
          <>
            <div className="md:col-span-3">
              <label className="mb-1 block text-xs font-medium text-gray-600">Тип помещения</label>
              <Select
                aria-label="Тип коммерческого помещения"
                value={commercialType}
                onChange={(e) => setCommercialType(e.target.value)}
                className="h-11 w-full md:h-12"
              >
                <option value="">Любой</option>
                {commercialChoices.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-xs font-medium text-gray-600">Площадь, м²</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={commercialAreaMin}
                  onChange={(e) => setCommercialAreaMin(e.target.value)}
                  placeholder="от"
                  aria-label="Площадь от"
                  className="h-11 md:h-12"
                />
                <Input
                  type="text"
                  inputMode="decimal"
                  value={commercialAreaMax}
                  onChange={(e) => setCommercialAreaMax(e.target.value)}
                  placeholder="до"
                  aria-label="Площадь до"
                  className="h-11 md:h-12"
                />
              </div>
            </div>
            <div className="md:col-span-6">
              <label className="mb-1 block text-xs font-medium text-gray-600">Поиск по тексту</label>
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Район, улица или ключевые слова"
                aria-label="Поиск по тексту объявлений"
                className="h-11 md:h-12"
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {variant === "hero" && (
          <Button type="button" variant="outline" className="h-10" onClick={scrollToHomeMap}>
            На карте
          </Button>
        )}
        {variant === "catalog" && (
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => applySearch("map")}
          >
            На карте
          </Button>
        )}
        <Button type="button" className="h-10 px-8" onClick={() => applySearch()}>
          Найти
        </Button>
      </div>
    </div>
  );
}
