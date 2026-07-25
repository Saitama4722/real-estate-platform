"use client";

import { useCompare } from "@/lib/compare";
import { HeaderNavLink } from "@/components/layout/HeaderNavLink";
import { Icon, Icons } from "@/components/ui/icon";

/**
 * «Сравнение» nav entry with a live count badge, mirroring HeaderFavoritesLink.
 * The badge shows only once 2+ items are selected (comparing one is meaningless)
 * and after the store hydrates (avoids an SSR/client mismatch).
 */
export function HeaderCompareLink() {
  const { count, ready } = useCompare();

  return (
    <HeaderNavLink href="/compare">
      <Icon icon={Icons.Compare} size={16} className="text-fg-muted" />
      Сравнение
      {ready && count >= 2 && (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-medium leading-5 text-white tabular-price">
          {count}
        </span>
      )}
    </HeaderNavLink>
  );
}
