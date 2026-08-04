/**
 * Digit-string helpers for money/number inputs that format as the user types.
 * Lifted out of SearchBar.tsx (the PriceInput reference implementation) so the
 * catalog filter panel can reuse them — per the CLAUDE.md note that the next
 * money-input consumer must lift these rather than reimplement.
 *
 * State convention: the OWNER of an input holds RAW DIGITS only ("1000000");
 * the grouped display string is derived for rendering and never stored.
 */

/** Keep only 0-9, dropping every other character (letters, spaces, punctuation). */
export function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "");
}

/**
 * Format a raw digit string with a space thousands separator, ru-RU style
 * ("1000000" → "1 000 000"). We use a plain ASCII space rather than
 * `Intl.NumberFormat("ru-RU")`'s narrow no-break space (U+202F), which renders
 * inconsistently and copy-pastes oddly. Empty input → empty string.
 */
export function groupDigits(rawDigits: string): string {
  // Drop leading zeros (but keep a lone "0") so "007" shows as "7".
  const trimmed = rawDigits.replace(/^0+(?=\d)/, "");
  if (!trimmed) return "";
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Loose user/URL decimal → canonical API decimal string, or undefined when the
 * value is empty or not a non-negative finite number ("1 234,5" → "1234.5").
 */
export function normalizeDecimalInput(raw: string): string | undefined {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return String(n);
}
