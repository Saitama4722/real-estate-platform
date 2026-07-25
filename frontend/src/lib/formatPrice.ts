/**
 * Format a numeric ruble amount with a space thousands separator, e.g.
 * 1200000 → "1 200 000 ₽". Uses a plain ASCII space (Intl's ru-RU separator is
 * a narrow no-break space, U+202F, which renders/copies inconsistently — the
 * project convention, see CLAUDE.md "Live Thousands-Separator Formatting").
 */
export function formatPriceRub(value: number): string {
  if (!Number.isFinite(value)) return "";
  const grouped = new Intl.NumberFormat("ru-RU")
    .format(Math.round(value))
    // Normalize ru-RU's narrow/no-break group separators to a plain ASCII space
    // (\s matches U+202F and U+00A0 in JS).
    .replace(/\s/g, " ");
  return `${grouped} ₽`;
}

/** Compact ruble label for chart axes, e.g. 1200000 → "1,2 млн ₽". */
export function formatPriceCompactRub(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    const s = (Math.round(m * 10) / 10).toString().replace(".", ",");
    return `${s} млн ₽`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1000)} тыс ₽`;
  }
  return `${Math.round(value)} ₽`;
}
