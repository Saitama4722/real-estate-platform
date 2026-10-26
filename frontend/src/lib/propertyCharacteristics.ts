/**
 * ⭐ THE ONE MAP of «what the property page's Характеристики shows, per type».
 *
 * It mirrors the CRM form's «Характеристики» section (`CrmPropertyFullForm.tsx`,
 * one block per property type) field for field, in the same order, and invents
 * nothing: every row comes from a model field the form can fill.
 *
 * Rules (do not break them one by one; they are what the owner reported):
 *  - Only a FILLED value is a row. Never an empty row, «—», «0» or «null» for
 *    missing data.
 *  - LOCATION is not a characteristic (no district, city, microdistrict, complex,
 *    address). It is one line near the title: `lib/propertyLocation.ts`.
 *  - One place per fact: floors live ONLY here (the summary tiles show just rooms
 *    and area).
 *  - Choice words («Автономное», «Иное») come from the server as `<field>_label`,
 *    the Django enum the CRM selects are built from: there is no label table on
 *    this side to drift.
 *  - Numbers: «225 м²», «1,3 сот.» through `lib/propertyArea.ts`.
 */
import type { PublicPropertyDetail } from "@/lib/publicProperty";
import { formatArea } from "@/lib/propertyArea";

export type UtilityKey = "gas" | "water" | "sewerage" | "electricity";

/** The words of the CRM checkboxes (Газ / Вода / Канализация / Электричество). */
export const UTILITY_LABELS: Record<UtilityKey, string> = {
  gas: "Газ",
  water: "Вода",
  sewerage: "Канализация",
  electricity: "Электричество",
};

export interface CharacteristicRow {
  key: string;
  label: string;
  /** Plain value. Exactly one of `value` / `utilities` is set. */
  value?: string;
  /** The ticked utilities, in a fixed order; rendered as chips. */
  utilities?: UtilityKey[];
}

function positive(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function text(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}

/** Collects the non-null rows, in the order given. */
class Rows {
  readonly list: CharacteristicRow[] = [];

  add(key: string, label: string, value: string | null | undefined) {
    if (value) this.list.push({ key, label, value });
  }

  area(key: string, label: string, v: string | number | null | undefined, field: "area_total" | "house_area" | "land_area") {
    const n = positive(v);
    if (n != null) this.add(key, label, formatArea(n, field));
  }

  int(key: string, label: string, v: number | null | undefined) {
    const n = positive(v);
    if (n != null) this.add(key, label, String(n));
  }

  utilities(flags: Partial<Record<UtilityKey, boolean | undefined>>) {
    const on = (Object.keys(UTILITY_LABELS) as UtilityKey[]).filter((k) => flags[k] === true);
    if (on.length) this.list.push({ key: "utilities", label: "Коммуникации", utilities: on });
  }
}

/** «3 из 9», or just «3» when the building height is unknown. */
function floorOf(floor: number | null | undefined, total: number | null | undefined): string | null {
  const f = positive(floor);
  const t = positive(total);
  if (f == null) return null;
  return t != null ? `${f} из ${t}` : String(f);
}

export function buildCharacteristicRows(p: PublicPropertyDetail): CharacteristicRow[] {
  const r = new Rows();

  if (p.property_type === "apartment" && p.apartment_details) {
    const d = p.apartment_details;
    r.int("rooms", "Комнат", d.rooms);
    r.area("area_total", "Общая площадь", d.area_total, "area_total");
    r.area("area_living", "Жилая площадь", d.area_living, "area_total");
    r.area("area_kitchen", "Площадь кухни", d.area_kitchen, "area_total");
    const floor = floorOf(d.floor, d.floors_total);
    r.add("floor", "Этаж", floor);
    // Building height on its own only when the floor itself is unknown, so the
    // number of floors appears ONCE.
    if (!floor) r.int("floors_total", "Этажей в доме", d.floors_total);
    r.add("renovation", "Ремонт", text(d.renovation_type_label));
    r.add("bathroom", "Санузел", text(d.bathroom_type_label));
    const outdoor = [d.has_balcony ? "Балкон" : null, d.has_loggia ? "Лоджия" : null].filter(Boolean);
    r.add("balcony", "Балкон и лоджия", outdoor.join(", "));
  } else if (p.property_type === "house" && p.house_details) {
    const d = p.house_details;
    r.area("house_area", "Площадь дома", d.house_area, "house_area");
    r.area("land_area", "Участок", d.land_area, "land_area");
    r.int("floors_total", "Этажей", d.floors_total);
    r.add("heating", "Отопление", text(d.heating_type_label));
    r.add("building", "Тип дома", text(d.building_type_label));
    r.utilities({
      gas: d.has_gas,
      water: d.has_water,
      sewerage: d.has_sewerage,
      electricity: d.has_electricity,
    });
  } else if (p.property_type === "land" && p.land_plot_details) {
    const d = p.land_plot_details;
    r.area("land_area", "Площадь участка", d.land_area, "land_area");
    r.add("land_category", "Категория земли", text(d.land_category_label));
    r.add("permitted_use", "Разрешённое использование", text(d.permitted_use_label));
    r.utilities({ gas: d.has_gas, water: d.has_water, electricity: d.has_electricity });
  } else if (p.property_type === "commercial" && p.commercial_details) {
    const d = p.commercial_details;
    r.add("commercial_type", "Тип коммерции", text(d.commercial_type_label));
    r.area("area_total", "Площадь", d.area_total, "area_total");
    const floor = floorOf(d.floor, d.floors_total);
    r.add("floor", "Этаж", floor);
    if (!floor) r.int("floors_total", "Этажей в здании", d.floors_total);
    r.add("entrance", "Тип входа", text(d.entrance_type));
    r.int("parking", "Парковочных мест", d.parking_spaces);
  }

  return r.list;
}
