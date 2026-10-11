/**
 * ⭐ THE ONE PLACE THAT DECIDES A PROPERTY'S AREA UNIT AND ITS TYPE LABEL.
 *
 * ⚠ THE UNIT DERIVES FROM THE FIELD, NEVER FROM A DEFAULT.
 *
 * A land plot entered as 8 соток rendered on the card as «8 м²» — a 50 000 000 ₽
 * plot the size of a bathroom. The cause was not a wrong field: the mapper read
 * `land_plot_details.land_area` correctly, then FLATTENED four differently-united
 * fields (`area_total`, `house_area`, `land_area`) into one bare `area: number`,
 * and the card appended a hardcoded « м² » to whatever arrived.
 *
 * So the fix is not "add a land branch" — that just moves the default. The unit
 * travels WITH the value as the field that produced it, and `AREA_FIELD_UNIT` is
 * keyed by field name. A new area field cannot inherit м² by accident: it has to
 * be added to `AreaField`, and TypeScript will not let it be formatted until it
 * appears in the unit table.
 */

export type PropertyTypeValue = "apartment" | "house" | "land" | "commercial";

/**
 * Singular type labels. THE project's existing wording — `crmPropertyForm.ts`
 * re-exports this as `CRM_PROPERTY_TYPE_LABELS` so there is one vocabulary
 * rather than two that can drift.
 */
export const PROPERTY_TYPE_LABELS: Record<PropertyTypeValue, string> = {
  apartment: "Квартира",
  house: "Дом",
  land: "Участок",
  commercial: "Коммерция",
};

/** Key into the shared `Icons` registry, which already has one per category. */
export const PROPERTY_TYPE_ICON: Record<PropertyTypeValue, string> = {
  apartment: "Apartment",
  house: "House",
  land: "Land",
  commercial: "Commercial",
};

/** The model fields an area can come from. Adding one REQUIRES a unit below. */
export type AreaField = "area_total" | "house_area" | "land_area";

/** ⚠ Keyed by FIELD, not by property type — that is the whole point. */
export const AREA_FIELD_UNIT: Record<AreaField, string> = {
  area_total: "м²",
  house_area: "м²",
  land_area: "сот.",
};

/** Which field a type's headline area comes from. */
export const PRIMARY_AREA_FIELD: Record<PropertyTypeValue, AreaField> = {
  apartment: "area_total",
  house: "house_area",
  land: "land_area",
  commercial: "area_total",
};

/**
 * "45.00" → "45", "45.5" → "45,5". The API sends decimals as strings the mappers
 * coerce with Number(), so a trailing ".00" is common; Russian uses a comma.
 */
export function formatAreaNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(2))).replace(".", ",");
}

/** «8 сот.» / «45 м²» — the unit comes from the field, always. */
export function formatArea(value: number, field: AreaField): string {
  return `${formatAreaNumber(value)} ${AREA_FIELD_UNIT[field]}`;
}

/**
 * True when a ₽-per-unit figure computed from this field may be labelled ₽/м².
 *
 * ⚠ Guard every price-per-area figure with this. Dividing a price by SOTKI and
 * printing «₽/м²» is the same class of bug as the card's, one step removed —
 * and it was live on the catalog card for land plots.
 */
export function isSquareMetreField(field: AreaField | undefined): boolean {
  return field === "area_total" || field === "house_area";
}

export function propertyTypeLabel(
  type: PropertyTypeValue | undefined,
): string | undefined {
  return type ? PROPERTY_TYPE_LABELS[type] : undefined;
}
