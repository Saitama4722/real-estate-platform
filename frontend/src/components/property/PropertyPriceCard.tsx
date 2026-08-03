"use client";

import { useEffect, useState } from "react";
import { Clock, Copy, Check, TrendingDown } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { formatPriceRub } from "@/lib/formatPrice";
import type { CatalogPropertyItem } from "@/components/catalog/types";

/**
 * Price block of the sticky sidebar on the property page.
 *
 * ⚠ EVERY NUMBER HERE IS DERIVED FROM REAL DATA — none of the mockup's
 * placeholders survive. The rules, and why:
 *
 * • Reduction amount and the struck-through price both come from the PRICE
 *   HISTORY PEAK, not from a stored `old_price`. `old_price` is a manually
 *   entered field that can contradict `is_price_reduced` (which is derived from
 *   the peak), and on this branch it is not exposed by the public API at all.
 *   Using the peak for both keeps the badge, the amount and the struck price
 *   telling one consistent story.
 * • The struck price renders ONLY when peak > current. A peak at or below the
 *   current price would advertise a price INCREASE as though it were a
 *   discount, which is worse than showing nothing.
 * • Price per m² renders only when a positive area exists — land plots and some
 *   commercial listings legitimately have none.
 */

/** How long the "copied" tick stays before reverting to the copy affordance. */
const COPIED_FEEDBACK_MS = 1800;

function formatUpdatedAt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Digits out of the already-formatted price ("5 000 000 ₽" -> 5000000). */
function parsePrice(formatted: string): number {
  const digits = formatted.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

export function PropertyPriceCard({
  property,
  children,
}: {
  property: CatalogPropertyItem;
  /**
   * The realtor block. It lives INSIDE this card rather than in a card of its
   * own: the reference sidebar is one panel — price, then a hairline, then the
   * agent, then the id footer — not a stack of separate cards.
   */
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(t);
  }, [copied]);

  const current = parsePrice(property.price);
  const history = property.priceHistory ?? [];
  const peak = history.length > 0 ? Math.max(...history.map((h) => h.price)) : 0;

  // Both gated on the SAME condition, so they can never disagree.
  const hasReduction = peak > current && current > 0;
  const reduction = hasReduction ? peak - current : 0;

  const area = property.area;
  const perSquare =
    area && area > 0 && current > 0 ? Math.round(current / area) : null;

  const objectLabel = `Объект #${property.id}`;

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(objectLabel);
      setCopied(true);
    } catch {
      // Clipboard can be unavailable (insecure origin, denied permission).
      // Staying silent is right: the id is visible next to the button anyway.
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-surface-raised shadow-md">
      <div className="px-6 pt-5 pb-5">
        {hasReduction && (
          <span className="mb-2.5 inline-flex h-[26px] items-center gap-1.5 rounded-full bg-accent-tint px-2.5 text-[12.5px] font-semibold text-accent">
            <Icon icon={TrendingDown} className="size-[14px]" />
            Цена снижена на {formatPriceRub(reduction)}
          </span>
        )}

        <p className="text-[33px] leading-tight font-bold tracking-tight text-fg">
          {property.price}
        </p>

        {(hasReduction || perSquare !== null) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            {hasReduction && (
              <span className="text-[14.5px] text-fg-muted line-through">
                {formatPriceRub(peak)}
              </span>
            )}
            {perSquare !== null && (
              <span className="text-[14.5px] text-fg-secondary">
                {formatPriceRub(perSquare)} за м²
              </span>
            )}
          </div>
        )}

        {property.updatedAt && formatUpdatedAt(property.updatedAt) && (
          <p className="mt-3 flex items-center gap-1.5 text-[13px] text-fg-muted">
            <Icon icon={Clock} className="size-[14px]" />
            Обновлено {formatUpdatedAt(property.updatedAt)}
          </p>
        )}
      </div>

      {children && (
        <>
          <div className="h-px bg-border" />
          <div className="px-6 pt-[18px] pb-[22px]">{children}</div>
        </>
      )}

      <div className="flex items-center justify-between border-t border-border bg-surface px-6 py-3 text-[12.5px] text-fg-muted">
        <span>{objectLabel}</span>
        <button
          type="button"
          onClick={copyId}
          className="flex items-center gap-1.5 transition-colors duration-150 ease-out hover:text-fg"
        >
          <Icon icon={copied ? Check : Copy} className="size-[13px]" />
          {copied ? "Скопировано" : "Скопировать"}
        </button>
      </div>
    </div>
  );
}
