/**
 * Display + `tel:` formatting for Russian numbers.
 *
 * Extracted from the realtor page so the server component and the client-side
 * phone-reveal button format the SAME number identically — the reveal swaps a
 * button for a link in place, and a mismatch there would read as the number
 * changing on click.
 *
 * Deliberately NOT `Intl.NumberFormat`/locale formatting: the group separator
 * must be a plain ASCII space so the number copies cleanly into other apps (the
 * same reason `groupDigits` in SearchBar.tsx avoids U+202F).
 */

/** Digits of a Russian number without the country code, or null if unrecognised. */
function localDigits(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  const local =
    digits.length === 11 && (digits[0] === "7" || digits[0] === "8")
      ? digits.slice(1)
      : digits;
  return local.length === 10 ? local : null;
}

/** `+79283330837` → `+7 928 333-08-37`. Unrecognised input is returned as-is. */
export function formatPhone(raw: string): string {
  const n = localDigits(raw);
  if (!n) return raw;
  return `+7 ${n.slice(0, 3)} ${n.slice(3, 6)}-${n.slice(6, 8)}-${n.slice(8)}`;
}

/**
 * `+79283330837` → `+7 (928) 333-08-37`. Unrecognised input is returned as-is.
 *
 * ⚠ TWO display forms now coexist deliberately, and this is the newer one:
 * `formatPhone` above renders `+7 928 333-08-37` (spaces) on the realtor page,
 * while the header and every phone INPUT mask (`PublicLeadInquiryForm`,
 * `SellPropertyForm`, `OwnerModal`) use the bracketed form. Unifying them is a
 * one-line change here plus a re-measure of the realtor page — worth doing, but
 * it was out of scope for the header work and is NOT an accident.
 */
export function formatPhoneParens(raw: string): string {
  const n = localDigits(raw);
  if (!n) return raw;
  return `+7 (${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6, 8)}-${n.slice(8)}`;
}

/** `tel:` target — digits only, normalised to a +7 country code. */
export function telHref(raw: string): string {
  const n = localDigits(raw);
  return n ? `tel:+7${n}` : `tel:${raw}`;
}
