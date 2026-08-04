"use client";

import { useState } from "react";
import { Icon, Icons } from "@/components/ui/icon";
import { formatPhone, telHref } from "@/lib/phoneFormat";

/**
 * «Показать телефон» → swaps itself for the number as a `tel:` link.
 *
 * Purely local state. There is DELIBERATELY no network call.
 *
 * An earlier version POSTed to `/api/properties/<id>/reveal_phone/` to reuse the
 * property pages' counting and throttling. That was wrong on two counts:
 *
 *   • **It polluted property analytics.** The endpoint's unit of accounting is a
 *     property — it writes a `PhoneRevealLog` row and increments that property's
 *     `phone_views_count`. A click here is not a view of any listing, so it was
 *     attributing realtor-page events to the realtor's first listing and
 *     corrupting its numbers.
 *   • **It was measuring nothing.** `PublicRealtorDetailView` already returns
 *     the phone in cleartext, and this page renders it in the contact aside and
 *     the closing band regardless. Gating a number that is already on the page
 *     behind a counted request records a "reveal" that reveals nothing.
 *
 * So this is a progressive-disclosure affordance, not an access control, and it
 * is implemented as exactly that. If per-realtor reveal analytics are ever
 * wanted they need their own realtor-scoped endpoint — do not reach for the
 * property one again.
 */
export function RealtorPhoneReveal({
  phone,
  buttonClassName,
  linkClassName,
}: {
  phone: string;
  /** Classes for the pre-click button. */
  buttonClassName: string;
  /** Classes for the revealed `tel:` link — keep the geometry identical so the
   *  swap does not shift the layout around it. */
  linkClassName: string;
}) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) {
    return (
      <a href={telHref(phone)} className={linkClassName}>
        <Icon icon={Icons.Phone} size={20} className="shrink-0" />
        {formatPhone(phone)}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className={buttonClassName}
    >
      <Icon icon={Icons.Phone} size={20} className="shrink-0" />
      Показать телефон
    </button>
  );
}
