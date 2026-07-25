/**
 * "Цена снижена" badge — shown next to the price when the current price is below
 * the property's peak recorded price (server-computed `is_price_reduced`).
 */
export function PriceDropBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-sm font-medium text-red-600 ring-1 ring-inset ring-red-200"
      title="Текущая цена ниже прежней"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 5v14" />
        <path d="M19 12l-7 7-7-7" />
      </svg>
      Цена снижена
    </span>
  );
}
