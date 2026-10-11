"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Loader2, Check } from "lucide-react";

import {
  fetchAddressSuggestions,
  reverseGeocode,
  SUGGEST_DEBOUNCE_MS,
  SUGGEST_MIN_CHARS,
  type AddressSuggestion,
} from "@/lib/addressSuggest";
// ⚠ Constants come from the LEAFLET-FREE module, never from AddressPickerMap.
// A static import from the map file would drag `leaflet` into the server bundle
// and defeat ssr:false — measured as `Error: window is not defined` + a 500.
import {
  resolveArea,
  type LatLng,
} from "@/components/address/addressMapConstants";

/**
 * ⚠ next/dynamic with ssr:false — NOT React.lazy. The map module statically
 * imports `leaflet`, which touches `window` while the module evaluates, so a
 * server render throws "window is not defined". React.lazy only defers the
 * load; it does not opt the component out of SSR.
 *
 * The `loading` placeholder is EXACTLY the map's height so the block does not
 * jump when the chunk arrives.
 */
const AddressPickerMap = dynamic(
  () => import("@/components/address/AddressPickerMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-surface-sunken text-xs text-fg-muted">
        Загрузка карты…
      </div>
    ),
  },
);

/** Fixed height, shared by the map and its placeholder — no layout shift. */
const MAP_HEIGHT_CLASS = "h-[260px]";

export interface AddressPickerProps {
  value: string;
  onChange: (value: string) => void;
  lat: number | null;
  lng: number | null;
  onPointChange: (lat: number | null, lng: number | null) => void;
  /** Name of the selected city — biases suggestions and centres the map. */
  cityName?: string;
  /**
   * Selected Район. ⛔ It does NOT narrow the suggestion query — the search is
   * city-wide for every row type. It centres the map and orders the results by
   * distance from itself. See `resolveArea`.
   */
  districtName?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
}

export function AddressPicker({
  value,
  onChange,
  lat,
  lng,
  onPointChange,
  cityName = "",
  districtName = "",
  disabled = false,
  error,
  required = false,
}: AddressPickerProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /**
   * True while the text in the field was written BY US (a picked suggestion or a
   * reverse geocode), false once the owner types their own.
   *
   * ⚠ THIS GUARDS THE MANUAL-ENTRY PATH, WHICH IS THE ONLY PATH IN SOME
   * VILLAGES. Nominatim's forward search cannot find «Подгорная улица, Бетта»
   * even though its own REVERSE geocoder returns exactly that address
   * `[measured]` — thinly-mapped хутора have street geometry but no searchable
   * street index. So in Бетта the owner must type the address themselves and
   * drop the pin. Before this ref was read, dropping the pin overwrote what
   * they had typed with whatever OSM thinks is nearest — replacing a correct
   * hand-typed address with a different one.
   */
  const textIsOursRef = useRef(false);

  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<"none" | "empty" | "unavailable">("none");
  const [confirmed, setConfirmed] = useState(false);

  const point: LatLng | null =
    lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : null;

  /**
   * ⭐ THE Район CENTRES THE MAP AND NOTHING ELSE.
   *
   * `area.center`/`area.zoom` follow the selected Район — that is deliberate
   * orientation, and it is why this memo depends on `districtName`. What the
   * Район no longer does is narrow the SEARCH: `resolveArea` scopes every query
   * to the whole city (see the superseded rule in its docblock).
   *
   * The centre also used to be `CITY_CENTERS[cityName] ?? REGION_DEFAULT`, which
   * knew only the two city names — so choosing Бетта fell through to
   * REGION_DEFAULT, i.e. KRASNODAR, and the map sat there while a Геленджик
   * village was selected.
   */
  const area = useMemo(
    () => resolveArea(districtName, cityName),
    [districtName, cityName],
  );

  // --- suggestions -------------------------------------------------------
  const runSuggest = useCallback(
    async (q: string) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      const outcome = await fetchAddressSuggestions(q, {
        city: cityName,
        district: districtName,
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      setLoading(false);
      if (outcome.status === "ok") {
        setItems(outcome.items);
        setOpen(true);
        setActive(-1);
        setNote("none");
      } else if (outcome.status === "empty") {
        setItems([]);
        setOpen(true);
        setNote("empty");
      } else {
        // ⚠ Provider down. Keep the field fully usable — a third-party outage
        // must never block a lead. No dropdown, just an explanation.
        setItems([]);
        setOpen(false);
        setNote("unavailable");
      }
    },
    [cityName, districtName],
  );

  const handleInput = (v: string) => {
    onChange(v);
    textIsOursRef.current = false; // the owner is typing — never overwrite this
    setConfirmed(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < SUGGEST_MIN_CHARS) {
      setItems([]);
      setOpen(false);
      setNote("none");
      return;
    }
    debounceRef.current = setTimeout(() => void runSuggest(v), SUGGEST_DEBOUNCE_MS);
  };

  const pick = (s: AddressSuggestion) => {
    textIsOursRef.current = true;
    onChange(s.label);
    setItems([]);
    setOpen(false);
    setActive(-1);
    setNote("none");
    setConfirmed(true);
    if (s.lat != null && s.lon != null) onPointChange(s.lat, s.lon);
    inputRef.current?.focus();
  };

  // --- map -> text (drag the marker / tap the map) ------------------------
  const handleMapPick = useCallback(
    async (p: LatLng) => {
      onPointChange(p.lat, p.lng);
      // ⭐ NEVER CLOBBER A HAND-TYPED ADDRESS. Filling an empty field from the
      // map is helpful; replacing what the owner typed is destructive, and in a
      // village where forward search finds nothing their typed text is the only
      // correct address there is.
      const ownTyped = value.trim().length > 0 && !textIsOursRef.current;
      if (ownTyped) {
        setConfirmed(true);
        setNote("none");
        return;
      }
      setLoading(true);
      const res = await reverseGeocode(p.lat, p.lng);
      setLoading(false);
      if (res.status === "ok") {
        textIsOursRef.current = true;
        onChange(res.label);
        setConfirmed(true);
        setNote("none");
      } else {
        // Point kept, text left as the owner typed it — better than blanking it.
        setNote("unavailable");
      }
    },
    [onChange, onPointChange, value],
  );

  // --- city change invalidates a previously picked address ----------------
  const prevCityRef = useRef(cityName);
  useEffect(() => {
    const prev = prevCityRef.current;
    if (prev === cityName) return;
    prevCityRef.current = cityName;
    // ⚠ ONLY CLEAR WHEN THE CITY REALLY CHANGES — not when it first ARRIVES.
    //
    // A blank -> «Геленджик» transition is initialisation, and treating it as a
    // change destroyed prefilled data: the CRM convert flow sets the address and
    // the owner's coordinates, then the city id resolves to a name a tick later,
    // and this effect wiped both `[measured]` — the address field came up empty
    // on a page whose banner said the address had been carried over. On /sell the
    // field is empty at that moment either way, so nothing there depended on it.
    //
    // Switching Геленджик -> Краснодар still clears, which is the real point: a
    // stale address from another city is worse than an empty field.
    if (!prev) return;
    onChange("");
    onPointChange(null, null);
    setItems([]);
    setOpen(false);
    setConfirmed(false);
    setNote("none");
  }, [cityName, onChange, onPointChange]);

  // --- dismiss on outside click ------------------------------------------
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (active >= 0 && active < items.length) {
        e.preventDefault();
        pick(items[active]);
      }
    }
  };

  return (
    <div>
      <label htmlFor={`${listId}-input`} className="ctr-label mb-[7px]">
        Адрес: улица и дом{" "}
        {required && <span className="ctr-label__req">*</span>}
      </label>

      <div ref={wrapRef} className="relative">
        <div className="relative">
          <MapPin
            aria-hidden="true"
            /* Position and size come from the SAME custom properties the
               field's padding is derived from (globals.css), so the icon and
               the text gutter cannot drift apart. */
            style={{
              left: "var(--field-icon-inset)",
              width: "var(--field-icon-size)",
              height: "var(--field-icon-size)",
            }}
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-fg-muted"
          />
          <input
            id={`${listId}-input`}
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => {
              if (items.length > 0) setOpen(true);
            }}
            disabled={disabled}
            placeholder="Например: Красная, 100"
            // The locality is already chosen above; repeating it inside this
            // field is what produced «Садовая 3 хутор Бетта» and zero results.
            title="Только улица и номер дома"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${listId}-list`}
            aria-autocomplete="list"
            aria-activedescendant={
              active >= 0 ? `${listId}-opt-${active}` : undefined
            }
            aria-invalid={error ? true : undefined}
            className="ctr-control ctr-control--icon-left ctr-control--icon-right block"
          />
          {loading && (
            <Loader2
              aria-hidden="true"
              style={{
                right: "var(--field-icon-inset)",
                width: "var(--field-icon-size)",
                height: "var(--field-icon-size)",
              }}
              className="absolute top-1/2 -translate-y-1/2 animate-spin text-brand motion-reduce:hidden"
            />
          )}
          {!loading && confirmed && (
            <Check
              aria-hidden="true"
              style={{
                right: "var(--field-icon-inset)",
                width: "var(--field-icon-size)",
                height: "var(--field-icon-size)",
              }}
              className="absolute top-1/2 -translate-y-1/2 text-brand"
            />
          )}
        </div>

        {/* ⚠ z-[1000] in the ARBITRARY-VALUE BRACKET FORM. Leaflet paints its
            panes at z 400–600 and this dropdown sits directly above a map, so it
            must clear them. A linter "canonicalising" this to z-1000 has twice
            produced a silently dead stacking context in this project. */}
        {open && (
          <ul
            id={`${listId}-list`}
            role="listbox"
            className="absolute left-0 top-full z-[1000] mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-surface-raised py-1 text-sm shadow-lg"
          >
            {items.length === 0 && note === "empty" && (
              <li className="px-3 py-2 text-fg-muted">
                {/* ⚠ SAY WHAT IS ACTUALLY TRUE, AND NOTHING MORE.
                    This used to read «В населённом пункте «X» нет базы адресов»
                    whenever the selected Район was a standalone settlement. It
                    was a claim about a place we were no longer searching — and
                    once the scope became the whole city it became simply false,
                    told to an owner whose street the city plainly has
                    («Краснодар + п. Северный + Хлебосольная» `[measured]`).
                    The search is city-wide, so the only honest report of an
                    empty result is that the STREET was not found. */}
                {cityName
                  ? `Улица не найдена в городе «${cityName}» — искали по всему городу и его населённым пунктам. Проверьте написание или введите улицу и номер дома вручную и поставьте метку на карте.`
                  : "Улица не найдена. Проверьте написание или введите улицу и номер дома вручную и поставьте метку на карте."}
              </li>
            )}
            {items.map((s, i) => (
              <li key={`${s.label}-${i}`}>
                <button
                  type="button"
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // mousedown, not click: it fires before the outside-click
                  // handler closes the list.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(s);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`block w-full px-3 py-2 text-left ${
                    i === active ? "bg-brand-tint" : ""
                  }`}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="font-medium text-fg">{s.label}</span>
                    {/* Street names repeat across the two cities, so every row
                        says which one it is. */}
                    {s.city && (
                      <span className="shrink-0 rounded-full bg-brand-tint px-1.5 py-px text-[11px] font-medium text-brand">
                        {s.city}
                      </span>
                    )}
                  </span>
                  {s.detail && (
                    <span className="mt-0.5 block truncate text-xs text-fg-muted">
                      {s.detail}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      {!error && note === "unavailable" && (
        <p className="mt-1 text-xs text-fg-muted">
          Подсказки адреса сейчас недоступны — введите адрес вручную и,
          при желании, укажите точку на карте.
        </p>
      )}
      {!error && note !== "unavailable" && (
        <p className="mt-1 text-xs text-fg-muted">
          {area.unmapped
            ? `Населённого пункта «${area.locality}» нет на карте OpenStreetMap: подсказки и метка недоступны. Введите улицу и номер дома — этого достаточно, заявку примем.`
            : area.locality
              ? `Только улица и номер дома — «${area.locality}» уже выбран выше. Подсказки ищутся по всему городу, поэтому у каждой указан её населённый пункт. Выберите подходящую или передвиньте метку на карте.`
              : "Начните вводить улицу и дом, выберите подсказку или передвиньте метку на карте."}
        </p>
      )}

      {/* Fixed height on the WRAPPER, matching the dynamic loader, so mounting
          the map cannot shift the form. */}
      <div
        className={`mt-2.5 overflow-hidden rounded-lg border border-border ${MAP_HEIGHT_CLASS}`}
      >
        <AddressPickerMap
          point={point}
          fallbackCenter={area.center}
          fallbackZoom={area.zoom}
          onPick={handleMapPick}
          disabled={disabled}
        />
      </div>
      {point && (
        <p className="mt-1 text-xs text-fg-muted">
          Координаты: {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
        </p>
      )}
    </div>
  );
}
