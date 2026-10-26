/**
 * ⭐ THE ONE PLACE THAT BUILDS A LISTING'S LOCATION LINE.
 *
 * Location is NOT a characteristic. It is shown once, as a line, near the title
 * («Геленджик, Магилат, улица Айвазовского, 41»), and never as a row of the
 * «Характеристики» block. Before this module the page printed «Геленджик,
 * Геленджик» (city and a district with the same name), dropped the microdistrict
 * and never showed the street, while a «Район» row repeated the district below.
 *
 * Rules:
 *  - parts in order: city, district, microdistrict, residential complex, street;
 *  - a part that repeats an earlier one is skipped («Геленджик» district of the
 *    city «Геленджик»);
 *  - the street/address (`public_address_text`, public by design: «только улица
 *    и номер дома») is added only on the property page (`includeAddress`); cards
 *    stay compact;
 *  - the complex gets the «ЖК» prefix unless the name already has one.
 */
export interface LocationParts {
  city?: string | null;
  district?: string | null;
  neighborhood?: string | null;
  residentialComplex?: string | null;
  address?: string | null;
}

function clean(v: string | null | undefined): string {
  return (v ?? "").trim();
}

export function buildLocationLine(
  parts: LocationParts,
  opts: { includeAddress?: boolean } = {},
): string {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(value);
  };

  push(clean(parts.city));
  push(clean(parts.district));
  push(clean(parts.neighborhood));
  const rc = clean(parts.residentialComplex);
  if (rc) push(/^жк\b/i.test(rc) ? rc : `ЖК ${rc}`);
  if (opts.includeAddress) push(clean(parts.address));

  // Nothing structured at all: the address is better than an empty line.
  if (out.length === 0) return clean(parts.address);
  return out.join(", ");
}
