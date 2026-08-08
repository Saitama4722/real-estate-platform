"use client";

import { usePathname } from "next/navigation";

/**
 * Hides the site chrome (Header / Footer / CompareBar) on authentication
 * routes, which are full-bleed split screens with their own branding.
 *
 * ⚠ It takes its children as a SLOT rather than rendering them itself. Header
 * and Footer stay server components — they are rendered on the server and
 * passed in already-rendered, so nothing about them becomes client-side and
 * neither file is modified. This was the cheap alternative to moving ~30 route
 * directories into a `(site)` group.
 *
 * `usePathname` resolves during SSR in the App Router, so the chrome is absent
 * in the first paint — there is no flash of a header on the login page.
 */

/** Exact paths only: a prefix match would also swallow /account/properties. */
const CHROMELESS_ROUTES = new Set(["/account/login", "/crm/login"]);

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname && CHROMELESS_ROUTES.has(pathname)) return null;
  return <>{children}</>;
}
