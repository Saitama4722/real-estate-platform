import Link from "next/link";
import { HeaderAccountControls } from "@/components/layout/header-account-controls";
import { HeaderFavoritesLink } from "@/components/layout/HeaderFavoritesLink";
import { HeaderCompareLink } from "@/components/layout/HeaderCompareLink";
import { HeaderNavLink } from "@/components/layout/HeaderNavLink";
import { MobileNav } from "@/components/layout/MobileNav";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button-link";

const navLinks = [
  { label: "Каталог", href: "/catalog" },
  { label: "Районы", href: "/districts" },
  { label: "Статьи", href: "/articles" },
];

/** Wordmark: Golos Text 700 + the accent-red dot. No logo file was supplied. */
export function Wordmark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span
      className={`inline-flex items-start gap-0.5 text-[22px] font-bold leading-none tracking-[-0.01em] ${
        inverse ? "text-white" : "text-fg"
      }`}
    >
      Centreal
      <span
        aria-hidden="true"
        className="mt-[3px] h-[7px] w-[7px] shrink-0 rounded-[2px] bg-accent"
      />
    </span>
  );
}

export function Header() {
  return (
    /*
     * `sticky` also anchors the MobileNav dropdown panel (absolute inset-x-0
     * top-full), so it spans the full header width on any page.
     *
     * z-[1000] MUST stay in the arbitrary-value bracket form — a bare `z-1000`
     * compiles to an EMPTY rule in this Tailwind v4 setup (silent no-op). Do NOT
     * let an IDE "canonicalize" it. The design system specifies z-50 for the
     * header, but that is BELOW Leaflet's map panes (z ~400–600); the homepage
     * and catalog render maps under this header, so it must clear them.
     */
    <header className="ctr-header sticky top-0 z-[1000] border-b border-border bg-surface-raised">
      <Container>
        {/* `ctr-header__row` is the element the compact-on-scroll rule shrinks
            from 64px to 52px — see the COMPACT HEADER block in globals.css. */}
        <div className="ctr-header__row flex h-16 items-center justify-between gap-2">
          <Link href="/" className="shrink-0">
            <Wordmark />
          </Link>
          <div className="flex min-w-0 items-center gap-2 lg:gap-4">
            {/* Desktop nav row: does not fit below ~1024px — hidden in favour
                of the hamburger (MobileNav) under lg. */}
            <nav aria-label="Основная навигация" className="hidden lg:block">
              <ul className="flex items-center gap-1">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <HeaderNavLink href={link.href}>{link.label}</HeaderNavLink>
                  </li>
                ))}
                <li>
                  <HeaderFavoritesLink />
                </li>
                <li>
                  <HeaderCompareLink />
                </li>
                <li className="ml-2">
                  {/* Was an inline `bg-blue-600` <Link> duplicating Button's
                      styling — now the shared ButtonLink so it cannot drift. */}
                  <ButtonLink href="/sell" size="sm">
                    Продать недвижимость
                  </ButtonLink>
                </li>
              </ul>
            </nav>
            <HeaderAccountControls />
            <MobileNav navLinks={navLinks} />
          </div>
        </div>
      </Container>
    </header>
  );
}
