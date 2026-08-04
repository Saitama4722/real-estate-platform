"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import {
  digitsOnly,
  groupDigits,
  normalizeDecimalInput,
} from "@/lib/priceDigits";
import { cn } from "@/lib/utils";

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

/** A row from /api/locations/neighborhoods/ (микрорайоны / urban areas). */
interface NeighborhoodRow {
  id: number;
  name: string;
  slug: string;
  city: { id: number; name: string; slug: string } | null;
  district: { id: number; name: string; slug: string } | null;
}

/**
 * "Kind" distinguishes which table (and thus which query param) a location
 * option maps to: districts → `district_slug`, neighborhoods → `neighborhood_slug`.
 * Slugs can theoretically collide across the two tables, so the kind is what
 * disambiguates a selection — never the bare slug alone.
 */
type LocationKind = "district" | "neighborhood";

/** A concrete location choice held in state; null = «Все районы». */
interface LocationSelection {
  kind: LocationKind;
  slug: string;
}

/** Merged, kind-tagged option rendered in the DistrictCombobox list. */
interface LocationOption {
  /** Unique across both tables: `${kind}:${slug}`. Used as React key + match id. */
  key: string;
  kind: LocationKind;
  slug: string;
  name: string;
  /** City name, shown as a suffix only when no city is selected (mixed list). */
  cityName?: string;
}

function selectionKey(sel: LocationSelection | null): string {
  return sel ? `${sel.kind}:${sel.slug}` : "";
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

/* digitsOnly / groupDigits / normalizeDecimalInput moved to lib/priceDigits.ts
   (shared with the catalog filter panel) — behaviour unchanged. */

interface BuildQueryInput {
  propertyType: PropertyType;
  citySlug: string;
  /** District or neighborhood choice; null = «Все районы» (no location filter). */
  location: LocationSelection | null;
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
  // Exactly one of district_slug / neighborhood_slug is set — the selected kind
  // decides which. A neighborhood (микрорайон) matches Property.neighborhood; a
  // district/suburb matches Property.district (backend supports both params).
  if (p.location) {
    if (p.location.kind === "neighborhood") {
      q.set("neighborhood_slug", p.location.slug);
    } else {
      q.set("district_slug", p.location.slug);
    }
  }

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

interface DistrictComboboxProps {
  /** Neighborhood options (микрорайоны) — shown first, under a group header. */
  neighborhoodOptions: LocationOption[];
  /** District/suburb options — shown after the neighborhoods. */
  districtOptions: LocationOption[];
  value: LocationSelection | null;
  onChange: (selection: LocationSelection | null) => void;
  /** Append the city name to each label when no city is selected (mixed list). */
  showCityName: boolean;
  className?: string;
}

/**
 * Searchable district / microdistrict picker — scoped to this search form only
 * (not shared). Merges two data sources: neighborhoods (микрорайоны, mapped to
 * `neighborhood_slug`) and districts/suburbs (mapped to `district_slug`). The
 * selected value carries its kind so the correct query param is emitted and slug
 * collisions between the two tables can't confuse the match.
 *
 * Looks like a native filter field but opens an in-place, substring-filterable
 * dropdown. Selection is mouse-click only; typing filters the visible options.
 */
function DistrictCombobox({
  neighborhoodOptions,
  districtOptions,
  value,
  onChange,
  showCityName,
  className,
}: DistrictComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  /* Links the combobox input to its popup for AT (aria-controls). The listbox
     is conditionally rendered, so the id must exist on the input regardless —
     that is valid: aria-controls may reference an element that appears later. */
  const listboxId = useId();

  const labelFor = useCallback(
    (o: LocationOption) =>
      showCityName && o.cityName ? `${o.name} — ${o.cityName}` : o.name,
    [showCityName],
  );

  const selectedKey = selectionKey(value);

  const selectedLabel = useMemo(() => {
    if (!value) return "Все районы";
    const all = [...neighborhoodOptions, ...districtOptions];
    const found = all.find((o) => o.kind === value.kind && o.slug === value.slug);
    return found ? labelFor(found) : "Все районы";
  }, [neighborhoodOptions, districtOptions, value, labelFor]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const filterOptions = useCallback(
    (opts: LocationOption[]) => {
      const q = query.trim().toLowerCase();
      if (!q) return opts;
      return opts.filter((o) => o.name.toLowerCase().includes(q));
    },
    [query],
  );

  const filteredNeighborhoods = useMemo(
    () => filterOptions(neighborhoodOptions),
    [filterOptions, neighborhoodOptions],
  );
  const filteredDistricts = useMemo(
    () => filterOptions(districtOptions),
    [filterOptions, districtOptions],
  );
  const hasAnyMatch = filteredNeighborhoods.length > 0 || filteredDistricts.length > 0;

  const openDropdown = () => {
    setQuery("");
    setOpen(true);
  };

  const handleSelect = (selection: LocationSelection | null) => {
    onChange(selection);
    setQuery("");
    setOpen(false);
  };

  const renderOption = (o: LocationOption) => (
    <li
      key={o.key}
      role="option"
      aria-selected={selectedKey === o.key}
      onMouseDown={(e) => {
        e.preventDefault();
        handleSelect({ kind: o.kind, slug: o.slug });
      }}
      className={cn(
        "cursor-pointer px-3 py-2 text-gray-900 hover:bg-gray-100",
        selectedKey === o.key && "font-medium text-blue-600",
      )}
    >
      {labelFor(o)}
    </li>
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-label="Район"
          value={open ? query : selectedLabel}
          placeholder={open ? selectedLabel : undefined}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={openDropdown}
          onMouseDown={() => {
            if (!open) openDropdown();
          }}
          className={cn(
            "w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-9 text-sm text-gray-900",
            "placeholder:text-gray-400",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            className,
          )}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className={cn("transition-transform", open && "rotate-180")}
          >
            <path
              d="M2 4l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      {open && (
        // z-[1000] MUST stay in the arbitrary-value bracket form. Not because
        // bare z-1000 is invalid (it is a documented v4 bare value) but because
        // the bracket form is immune to the build/version drift that once
        // emitted an empty rule here — see the z-index section in CLAUDE.md.
        // Do NOT let an editor "canonicalize" this back to `z-1000`.
        // 1000+ is required per the Leaflet-overlay rule.
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[1000] mt-1 max-h-64 overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm text-gray-900 shadow-lg"
        >
          <li
            role="option"
            aria-selected={value === null}
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelect(null);
            }}
            className={cn(
              "cursor-pointer px-3 py-2 text-gray-900 hover:bg-gray-100",
              value === null && "font-medium text-blue-600",
            )}
          >
            Все районы
          </li>

          {/* Microdistricts first, under a group header (Krasnodar's
              «Микрорайоны Краснодара» container and Gelendzhik's urban areas
              both surface here). Header is non-selectable. */}
          {filteredNeighborhoods.length > 0 && (
            <li
              role="presentation"
              className="select-none px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400"
            >
              Микрорайоны
            </li>
          )}
          {filteredNeighborhoods.map(renderOption)}

          {filteredDistricts.length > 0 && (
            <li
              role="presentation"
              className="select-none px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400"
            >
              Районы и населённые пункты
            </li>
          )}
          {filteredDistricts.map(renderOption)}

          {!hasAnyMatch && (
            <li className="px-3 py-2 text-gray-400">Ничего не найдено</li>
          )}
        </ul>
      )}
    </div>
  );
}

interface PriceInputProps {
  /** Raw digit string (no spaces) — the source of truth held by the parent. */
  value: string;
  /** Called with the sanitized raw digit string on every edit. */
  onRawChange: (rawDigits: string) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
}

/**
 * Digit-only price field with live "1 000 000" thousands grouping. Scoped to the
 * search form's «Цена, ₽» pair only. The parent stores raw digits; this input
 * displays the grouped form and reports back sanitized digits.
 *
 * Cursor handling: after reformatting we restore the caret by digit count (how
 * many digits sit left of the caret), not raw string offset — so inserted/removed
 * spaces don't make the caret jump when editing in the middle of the number.
 */
function PriceInput({
  value,
  onRawChange,
  placeholder,
  ariaLabel,
  className,
}: PriceInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const display = groupDigits(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const rawTyped = el.value;
    const selEnd = el.selectionStart ?? rawTyped.length;

    // Count digits to the left of the caret in the just-typed value.
    const digitsBeforeCaret = digitsOnly(rawTyped.slice(0, selEnd)).length;

    const nextRaw = digitsOnly(rawTyped);
    const nextDisplay = groupDigits(nextRaw);

    onRawChange(nextRaw);

    // Restore the caret after the same number of digits in the formatted string.
    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (!node) return;
      let pos = 0;
      let seen = 0;
      while (pos < nextDisplay.length && seen < digitsBeforeCaret) {
        if (/\d/.test(nextDisplay[pos])) seen += 1;
        pos += 1;
      }
      node.setSelectionRange(pos, pos);
    });
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
    />
  );
}

export type SearchBarVariant = "hero" | "catalog";

export interface SearchBarProps {
  variant: SearchBarVariant;
  initialPropertyType?: string;
  initialCitySlug?: string;
  initialDistrictSlug?: string;
  initialNeighborhoodSlug?: string;
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
  initialNeighborhoodSlug,
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
  // Location filter: a district/suburb OR a neighborhood (микрорайон), tagged by
  // kind. Hydrated from whichever URL param is present on the catalog variant
  // (neighborhood_slug wins if both somehow appear — only one is ever set).
  const [locationSelection, setLocationSelection] =
    useState<LocationSelection | null>(() => {
      if (!fromCatalog) return null;
      const nb = (initialNeighborhoodSlug ?? "").trim();
      if (nb) return { kind: "neighborhood", slug: nb };
      const ds = (initialDistrictSlug ?? "").trim();
      if (ds) return { kind: "district", slug: ds };
      return null;
    });
  const [rooms, setRooms] = useState<RoomsSelectValue>(() =>
    fromCatalog ? roomsSelectFromInitial(initialRooms, initialRoomsMin) : "",
  );
  const [marketType, setMarketType] = useState(() =>
    fromCatalog ? (initialMarketType ?? "").trim() : "",
  );
  const [search, setSearch] = useState(() =>
    fromCatalog ? (initialSearch ?? "") : "",
  );
  // Price state holds RAW DIGITS only (no spaces); PriceInput renders the grouped
  // "1 000 000" display. digitsOnly() guards against any formatting arriving via
  // the URL on the catalog variant.
  const [priceMin, setPriceMin] = useState(() =>
    fromCatalog ? digitsOnly(initialPriceMin ?? "") : "",
  );
  const [priceMax, setPriceMax] = useState(() =>
    fromCatalog ? digitsOnly(initialPriceMax ?? "") : "",
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
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodRow[]>([]);
  const [commercialChoices, setCommercialChoices] = useState<ChoiceEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetchJson<CityRow[] | { results: CityRow[] }>(
        "/api/locations/cities",
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

  // Fetch districts AND neighborhoods for the selected city. Neighborhoods
  // (микрорайоны) live in a separate table but must appear in the same picker —
  // otherwise a buyer can't filter by a microdistrict a realtor tagged in the CRM.
  useEffect(() => {
    let cancelled = false;
    const qs = selectedCityId != null ? `?city=${selectedCityId}` : "";
    (async () => {
      const [dList, nList] = await Promise.all([
        fetchJson<DistrictRow[] | { results: DistrictRow[] }>(
          `/api/locations/districts/${qs}`,
        ),
        fetchJson<NeighborhoodRow[] | { results: NeighborhoodRow[] }>(
          `/api/locations/neighborhoods/${qs}`,
        ),
      ]);
      if (cancelled) return;
      const dRows = Array.isArray(dList) ? dList : dList?.results;
      const nRows = Array.isArray(nList) ? nList : nList?.results;
      setDistricts(Array.isArray(dRows) ? dRows : []);
      setNeighborhoods(Array.isArray(nRows) ? nRows : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCityId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchJson<{ commercial_types?: ChoiceEntry[] }>(
        "/api/locations/choices",
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

  // Kind-tagged option lists for the combobox. Neighborhoods are rendered first
  // (as microdistricts), districts after. Backend already orders both by
  // sort_order then name, so we preserve incoming order.
  const neighborhoodOptions = useMemo<LocationOption[]>(
    () =>
      neighborhoods.map((n) => ({
        key: `neighborhood:${n.slug}`,
        kind: "neighborhood",
        slug: n.slug,
        name: n.name,
        cityName: n.city?.name,
      })),
    [neighborhoods],
  );

  const districtOptions = useMemo<LocationOption[]>(
    () =>
      districts.map((d) => ({
        key: `district:${d.slug}`,
        kind: "district",
        slug: d.slug,
        name: d.name,
        cityName: d.city?.name,
      })),
    [districts],
  );

  const queryPayload = useCallback(
    (view?: "map"): BuildQueryInput => ({
      propertyType,
      citySlug,
      location: locationSelection,
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
      locationSelection,
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
    // Reset the location filter — the previous district/neighborhood belongs to
    // the old city and its options are about to be refetched.
    setLocationSelection(null);
  };

  const onPropertyTypeChange = (next: PropertyType) => {
    setPropertyType(next);
    if (next !== "apartment") {
      setRooms("");
      setMarketType("");
    }
  };

  return (
    /*
     * Shared by the hero and catalog variants.
     *
     * OPAQUE `bg-surface-raised`, not the old `bg-white/95` + `backdrop-blur-sm`:
     * on the homepage this panel is now pulled UP so it straddles the hero's
     * bottom edge, and a translucent panel let the navy show through its top
     * half and the warm page background through its bottom — a visible seam
     * across the middle of the card. Opaque also matches "white surfaces" in the
     * design. `shadow-lg` alone now carries the design's shadow colour; the extra
     * `shadow-black/20` was overriding the token with plain black.
     */
    <div className="rounded-2xl bg-surface-raised p-4 shadow-lg md:p-5">
      {/*
       * The design's `.ctr-seg` pill group: a neutral-100 track with a white
       * "thumb" on the active option. Replaces two full Buttons (a primary + a
       * disabled outline), which read as two independent actions rather than one
       * either/or choice. The divider rule that used to sit under them is gone —
       * the kit has none.
       *
       * `role="group"` + `aria-pressed`, NOT the kit's `role="tablist"`: there
       * are no tabpanels here, and tab roles without them mislead screen readers
       * into expecting panel switching.
       */}
      <div
        role="group"
        aria-label="Тип сделки"
        className="inline-flex gap-0.5 rounded-full bg-gray-100 p-1"
      >
        <button
          type="button"
          aria-pressed="true"
          className="h-8 rounded-full bg-white px-4 text-[14px] leading-5 font-medium text-blue-700 shadow-xs"
        >
          Продажа
        </button>
        <button
          type="button"
          aria-pressed="false"
          disabled
          title="Аренда недоступна в текущем MVP"
          className="h-8 rounded-full px-4 text-[14px] leading-5 font-medium text-fg-secondary transition-colors duration-150 ease-out hover:text-fg disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:text-gray-400"
        >
          Аренда
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-3">
          <label className="mb-1.5 block text-[13px] leading-4 font-medium text-fg-secondary">Тип недвижимости</label>
          <Select
            aria-label="Тип недвижимости"
            value={propertyType}
            onChange={(event) => onPropertyTypeChange(event.target.value as PropertyType)}
            className="h-11 w-full md:h-10"
          >
            <option value="apartment">Квартиры</option>
            <option value="house">Дома</option>
            <option value="land">Участки</option>
            <option value="commercial">Коммерческая</option>
          </Select>
        </div>

        <div className="md:col-span-3">
          <label className="mb-1.5 block text-[13px] leading-4 font-medium text-fg-secondary">Город</label>
          <Select
            aria-label="Город"
            value={citySlug}
            onChange={(e) => onCityChange(e.target.value)}
            className="h-11 w-full md:h-10"
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
          <label className="mb-1.5 block text-[13px] leading-4 font-medium text-fg-secondary">Район</label>
          <DistrictCombobox
            neighborhoodOptions={neighborhoodOptions}
            districtOptions={districtOptions}
            value={locationSelection}
            onChange={setLocationSelection}
            showCityName={!citySlug}
            className="h-11 md:h-10"
          />
        </div>

        <div className="md:col-span-3">
          <label className="mb-1.5 block text-[13px] leading-4 font-medium text-fg-secondary">Цена, ₽</label>
          <div className="flex gap-2">
            <PriceInput
              value={priceMin}
              onRawChange={setPriceMin}
              placeholder="от"
              ariaLabel="Цена от"
              className="h-11 md:h-10"
            />
            <PriceInput
              value={priceMax}
              onRawChange={setPriceMax}
              placeholder="до"
              ariaLabel="Цена до"
              className="h-11 md:h-10"
            />
          </div>
        </div>

        {propertyType === "apartment" && (
          <>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-[13px] leading-4 font-medium text-fg-secondary">Комнат</label>
              <Select
                aria-label="Количество комнат"
                value={rooms}
                onChange={(e) => setRooms(e.target.value as RoomsSelectValue)}
                className="h-11 w-full md:h-10"
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
              <label className="mb-1.5 block text-[13px] leading-4 font-medium text-fg-secondary">Рынок</label>
              <Select
                aria-label="Сегмент рынка"
                value={marketType}
                onChange={(e) => setMarketType(e.target.value)}
                className="h-11 w-full md:h-10"
              >
                <option value="">Любой</option>
                <option value="secondary">Вторичка</option>
                <option value="new_building">Новостройка</option>
                <option value="other">Иное</option>
              </Select>
            </div>
            <div className="md:col-span-8">
              <label className="mb-1.5 block text-[13px] leading-4 font-medium text-fg-secondary">Поиск по тексту</label>
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Адрес, улица или ключевые слова"
                aria-label="Поиск по тексту объявлений"
                className="h-11 md:h-10"
              />
            </div>
          </>
        )}

        {propertyType === "house" && (
          <>
            <div className="md:col-span-3">
              <label className="mb-1.5 block text-[13px] leading-4 font-medium text-fg-secondary">Площадь дома, м²</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={houseAreaMin}
                  onChange={(e) => setHouseAreaMin(e.target.value)}
                  placeholder="от"
                  aria-label="Площадь дома от"
                  className="h-11 md:h-10"
                />
                <Input
                  type="text"
                  inputMode="decimal"
                  value={houseAreaMax}
                  onChange={(e) => setHouseAreaMax(e.target.value)}
                  placeholder="до"
                  aria-label="Площадь дома до"
                  className="h-11 md:h-10"
                />
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="mb-1.5 block text-[13px] leading-4 font-medium text-fg-secondary">Площадь участка, сот.</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={houseLandAreaMin}
                  onChange={(e) => setHouseLandAreaMin(e.target.value)}
                  placeholder="от"
                  aria-label="Площадь участка от"
                  className="h-11 md:h-10"
                />
                <Input
                  type="text"
                  inputMode="decimal"
                  value={houseLandAreaMax}
                  onChange={(e) => setHouseLandAreaMax(e.target.value)}
                  placeholder="до"
                  aria-label="Площадь участка до"
                  className="h-11 md:h-10"
                />
              </div>
            </div>
            <div className="md:col-span-6">
              <label className="mb-1.5 block text-[13px] leading-4 font-medium text-fg-secondary">Поиск по тексту</label>
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Район, населённый пункт или ключевые слова"
                aria-label="Поиск по тексту объявлений"
                className="h-11 md:h-10"
              />
            </div>
          </>
        )}

        {propertyType === "land" && (
          <>
            <div className="md:col-span-3">
              <label className="mb-1.5 block text-[13px] leading-4 font-medium text-fg-secondary">Площадь участка, сот.</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={landAreaMin}
                  onChange={(e) => setLandAreaMin(e.target.value)}
                  placeholder="от"
                  aria-label="Площадь участка от"
                  className="h-11 md:h-10"
                />
                <Input
                  type="text"
                  inputMode="decimal"
                  value={landAreaMax}
                  onChange={(e) => setLandAreaMax(e.target.value)}
                  placeholder="до"
                  aria-label="Площадь участка до"
                  className="h-11 md:h-10"
                />
              </div>
            </div>
            <div className="md:col-span-9">
              <label className="mb-1.5 block text-[13px] leading-4 font-medium text-fg-secondary">Поиск по тексту</label>
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Район, СНТ или ключевые слова"
                aria-label="Поиск по тексту объявлений"
                className="h-11 md:h-10"
              />
            </div>
          </>
        )}

        {propertyType === "commercial" && (
          <>
            <div className="md:col-span-3">
              <label className="mb-1.5 block text-[13px] leading-4 font-medium text-fg-secondary">Тип помещения</label>
              <Select
                aria-label="Тип коммерческого помещения"
                value={commercialType}
                onChange={(e) => setCommercialType(e.target.value)}
                className="h-11 w-full md:h-10"
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
              <label className="mb-1.5 block text-[13px] leading-4 font-medium text-fg-secondary">Площадь, м²</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={commercialAreaMin}
                  onChange={(e) => setCommercialAreaMin(e.target.value)}
                  placeholder="от"
                  aria-label="Площадь от"
                  className="h-11 md:h-10"
                />
                <Input
                  type="text"
                  inputMode="decimal"
                  value={commercialAreaMax}
                  onChange={(e) => setCommercialAreaMax(e.target.value)}
                  placeholder="до"
                  aria-label="Площадь до"
                  className="h-11 md:h-10"
                />
              </div>
            </div>
            <div className="md:col-span-6">
              <label className="mb-1.5 block text-[13px] leading-4 font-medium text-fg-secondary">Поиск по тексту</label>
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Район, улица или ключевые слова"
                aria-label="Поиск по тексту объявлений"
                className="h-11 md:h-10"
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {variant === "hero" && (
          <Button
            type="button"
            variant="outline"
            icon={Icons.Map}
            onClick={scrollToHomeMap}
          >
            На карте
          </Button>
        )}
        {variant === "catalog" && (
          <Button
            type="button"
            variant="outline"
            icon={Icons.Map}
            onClick={() => applySearch("map")}
          >
            На карте
          </Button>
        )}
        {/* Primary search action is the design's `lg` control (48px) — it is the
            most important button on the page. Height comes from `size`, never
            from className (see button-classes.ts). */}
        <Button
          type="button"
          size="lg"
          icon={Icons.Search}
          onClick={() => applySearch()}
        >
          Найти
        </Button>
      </div>
    </div>
  );
}
