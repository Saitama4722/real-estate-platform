/**
 * Card-badge derivations shared by BOTH property mappers.
 *
 * Lives in its own module rather than in one mapper because
 * `publicPropertyList.ts` already imports from `publicProperty.ts`
 * (getPublicApiBaseUrl) — putting these in either would make the other's
 * import circular. Every surface that renders a PropertyCard goes through one
 * of those two mappers, so this is the single definition of what each badge
 * means.
 */

/** «Новостройка» / «Вторичка». "other" and empty deliberately render nothing. */
const MARKET_LABEL: Record<string, string> = {
  new_building: "Новостройка",
  secondary: "Вторичка",
};

export function marketLabelFor(marketType: string | null | undefined): string | undefined {
  if (!marketType) return undefined;
  return MARKET_LABEL[marketType];
}

/**
 * Formatted previous price, or undefined when there is nothing to strike:
 * missing, unparseable, or NOT strictly above the current price (an equal or
 * lower "old" price is not a markdown — striking it would misinform).
 */
export function formatOldPrice(
  oldPrice: string | null | undefined,
  price: string,
  formatPrice: (value: string) => string,
): string | undefined {
  if (!oldPrice) return undefined;
  const o = Number(oldPrice);
  const p = Number(price);
  if (!Number.isFinite(o) || !Number.isFinite(p) || o <= p) return undefined;
  return formatPrice(oldPrice);
}
