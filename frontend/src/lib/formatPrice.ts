/**
 * Format a numeric ruble amount with a space thousands separator, e.g.
 * 1200000 → "1 200 000 ₽". Uses a plain ASCII space (Intl's ru-RU separator is
 * a narrow no-break space, U+202F, which renders/copies inconsistently — the
 * project convention, see CLAUDE.md "Live Thousands-Separator Formatting").
 */
/**
 * Space-grouped number per the project convention — Intl's ru-RU separator is
 * a narrow/no-break space (U+202F / U+00A0), normalized to a plain ASCII
 * space (\s matches both in JS). EVERY user-facing grouped number must go
 * through here (or formatPriceRub below); review finding 14 caught a mapper
 * calling Intl directly and shipping U+202F onto the cards.
 */
export function formatGroupedNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value).replace(/\s/g, " ");
}

export function formatPriceRub(value: number): string {
  if (!Number.isFinite(value)) return "";
  return `${formatGroupedNumber(Math.round(value))} ₽`;
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
