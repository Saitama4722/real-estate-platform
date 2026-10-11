import Link from "next/link";
import { HeaderAccountControls } from "@/components/layout/header-account-controls";
import { HeaderFavoritesLink } from "@/components/layout/HeaderFavoritesLink";
import { HeaderCompareLink } from "@/components/layout/HeaderCompareLink";
import { HeaderNavLink } from "@/components/layout/HeaderNavLink";
import { HeaderPhone } from "@/components/layout/HeaderPhone";
import { MobileNav } from "@/components/layout/MobileNav";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button-link";
import { fetchAgencyPhone } from "@/lib/homepageTextBlocks";

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

export async function Header() {
  /*
   * Awaited on the SERVER so the number is present in the first paint — no
   * client fetch, no post-hydration insertion, no layout shift. It shares the
   * homepage text-blocks fetch (same URL + `revalidate: 60`), so on `/` it is
   * free and elsewhere it is one small cached JSON. A failed fetch yields ""
   * and the phone is simply absent.
   */
  const agencyPhone = await fetchAgencyPhone();

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
            {/* Desktop nav row. Hidden in favour of the hamburger (MobileNav)
                under lg. The row's intrinsic width is ~1047px — 23px more than
                a 1024px viewport — so the `ctr-header__nav` FIT BAND rule in
                globals.css compresses the discretionary gaps between 1024 and
                1100px. If you add/rename a nav item, re-measure that band
                (see the rule's comment for the method). */}
            <nav
              aria-label="Основная навигация"
              className="ctr-header__nav hidden lg:block"
            >
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
                {/*
                  AGENCY PHONE — between the nav links and the CTA, as specified.
                  The conditional is on the <li>, not inside HeaderPhone: an
                  empty-but-rendered flex child would still take the row's gap,
                  so a cleared phone must remove the element entirely.

                  TWO desktop forms, and BOTH breakpoints are MEASURED, not
                  chosen. The row already needs ~1047px at lg with a favourite
                  present (see the HEADER FIT BAND in globals.css), so:
                    • 1280+  full number (173px). Clean in all four states.
                    • 1140–1279  44px icon. `[measured]` the icon at 1100 gave
                      scrollWidth 1121 with one favourite — 1140 is the first
                      width where it fits.
                    • 1024–1139  NOTHING. There is genuinely no room: the header
                      is already at capacity in this band, which is the
                      pre-existing open bug (a favourite alone makes it 1047 at
                      1024). Adding anything here would make a known overflow
                      worse. Freeing this band means fixing that bug first —
                      hide the count badge below 1100, or raise the desktop-nav
                      breakpoint.
                  If you retune any of this, re-measure WITH a favourite present
                  AND logged in — both widen the row.
                */}
                {agencyPhone && (
                  <li className="hidden min-[1280px]:block">
                    <HeaderPhone phone={agencyPhone} variant="full" />
                  </li>
                )}
                {agencyPhone && (
                  <li className="hidden min-[1140px]:block min-[1280px]:hidden">
                    <HeaderPhone phone={agencyPhone} variant="icon" />
                  </li>
                )}
                <li className="ml-2">
                  {/* Was an inline `bg-blue-600` <Link> duplicating Button's
                      styling — now the shared ButtonLink so it cannot drift. */}
                  <ButtonLink href="/sell" size="sm">
                    Продать недвижимость
                  </ButtonLink>
                </li>
              </ul>
            </nav>
            {/* Below lg the desktop <ul> is display:none, so the phone needs its
                own tappable affordance next to the hamburger.

                ⚠ It starts at `sm` (640px), NOT 0. `[measured]`: at 375px a
                LOGGED-IN header is 392px with this icon — the account chip is
                164px against the logged-out button's 81px, and the extra 44px
                tips it over. Logged out at 375 had room, but the visibility of
                a server-rendered element cannot depend on a client-side login
                state, so the safe width wins. Below 640px the number lives in
                the MobileNav panel, one tap away. */}
            {agencyPhone && (
              <div className="hidden sm:block lg:hidden">
                <HeaderPhone phone={agencyPhone} variant="icon" />
              </div>
            )}
            <HeaderAccountControls />
            <MobileNav navLinks={navLinks} phone={agencyPhone} />
          </div>
        </div>
      </Container>
    </header>
  );
}
