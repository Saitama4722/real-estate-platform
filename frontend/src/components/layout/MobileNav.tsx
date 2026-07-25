"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HeaderFavoritesLink } from "@/components/layout/HeaderFavoritesLink";
import { HeaderCompareLink } from "@/components/layout/HeaderCompareLink";
import { ButtonLink } from "@/components/ui/button-link";
import { Icon, Icons } from "@/components/ui/icon";

export interface MobileNavLink {
  label: string;
  href: string;
}

/** Per-destination glyph, matching the reference mobile menu. */
const MOBILE_NAV_ICONS: Record<string, (typeof Icons)[keyof typeof Icons]> = {
  "/catalog": Icons.Search,
  "/districts": Icons.Address,
  "/articles": Icons.Article,
};

/**
 * Mobile (< lg) navigation for the shared Header: a hamburger button that
 * toggles a full-width dropdown panel anchored to the header. The desktop
 * nav row does not fit below ~1024px and used to force a ~712–795px minimum
 * document width, making every page horizontally scrollable on phones.
 *
 * The panel is positioned against the <header> element (which is `relative`),
 * so it spans the full header width regardless of where this component sits
 * inside the header's flex row.
 */
export function MobileNav({ navLinks }: { navLinks: MobileNavLink[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  // Close when navigation actually happens (covers the reused badge links,
  // which don't expose an onClick prop).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Close on outside click (mousedown, same idiom as DistrictCombobox).
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return (
    <div ref={containerRef} className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-fg transition-colors duration-150 hover:bg-gray-100 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(26,95,224,0.25)]"
      >
        <Icon icon={open ? Icons.Close : Icons.Menu} size={20} />
      </button>

      {open && (
        /*
         * z-[1000] MUST stay in the arbitrary-value bracket form. In this
         * Tailwind v4 setup a bare `z-1000` compiles to an EMPTY rule (silent
         * no-op) — do NOT let an IDE "canonicalize" this class. 1000+ is also
         * required to render above Leaflet map panes (z ~400–600) on the
         * homepage/catalog pages underneath this panel.
         */
        <div
          id="mobile-nav-panel"
          className="absolute inset-x-0 top-full z-[1000] border-b border-border bg-surface-raised shadow-lg"
        >
          <nav aria-label="Мобильная навигация" className="px-4 py-2">
            <ul className="flex flex-col">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-2 py-3 text-base font-medium text-fg transition-colors duration-150 hover:bg-gray-50"
                  >
                    <Icon
                      icon={MOBILE_NAV_ICONS[link.href] ?? Icons.ChevronRight}
                      size={20}
                      className="text-fg-muted"
                    />
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="flex min-h-11 items-center px-2">
                <HeaderFavoritesLink />
              </li>
              <li className="flex min-h-11 items-center px-2">
                <HeaderCompareLink />
              </li>
              <li className="border-t border-gray-100 py-3">
                {/* Was a second hand-rolled `bg-blue-600` copy of the header CTA. */}
                <ButtonLink
                  href="/sell"
                  fullWidth
                  onClick={() => setOpen(false)}
                >
                  Продать недвижимость
                </ButtonLink>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
