"use client";

import { useFavorites } from "@/lib/favorites";
import { HeaderNavLink } from "@/components/layout/HeaderNavLink";
import { Icon, Icons } from "@/components/ui/icon";

/**
 * «Избранное» nav entry with a live count badge. The count reads from the
 * shared favorites context, so it updates whenever a heart is toggled anywhere
 * in the app (and across tabs) with no page reload. Renders nothing until the
 * store hydrates to avoid an SSR/client mismatch on the badge number.
 */
export function HeaderFavoritesLink() {
  const { count, ready } = useFavorites();

  return (
    <HeaderNavLink href="/favorites">
      <Icon icon={Icons.Heart} size={16} className="text-fg-muted" />
      Избранное
      {ready && count > 0 && (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-medium leading-5 text-white tabular-price">
          {count}
        </span>
      )}
    </HeaderNavLink>
  );
}
