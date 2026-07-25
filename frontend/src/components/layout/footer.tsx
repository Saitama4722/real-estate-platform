import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Wordmark } from "@/components/layout/header";

/** Bottom-row nav/legal links. Horizontal, right of the copyright. */
const legalLinks = [
  { label: "Каталог", href: "/catalog" },
  { label: "Статьи", href: "/articles" },
  { label: "Политика конфиденциальности", href: "/privacy" },
  { label: "Пользовательское соглашение", href: "/terms" },
];

/**
 * «Популярные запросы» — canonical SEO landing routes, now SITEWIDE.
 *
 * Listed in the design's own order: the grid below fills row-major across two
 * columns, which reproduces the kit's column split exactly
 * (col 1 = квартиру Крд / участок Крд / дом Гел, col 2 = дом Крд / квартиру Гел
 * / коммерцию Крд) without needing to hand-split the array.
 */
const popularQueries = [
  { label: "Купить квартиру в Краснодаре", href: "/krasnodar/kupit-kvartiru" },
  { label: "Купить дом в Краснодаре", href: "/krasnodar/kupit-dom" },
  { label: "Купить участок в Краснодаре", href: "/krasnodar/kupit-uchastok" },
  { label: "Купить квартиру в Геленджике", href: "/gelendzhik/kupit-kvartiru" },
  { label: "Купить дом в Геленджике", href: "/gelendzhik/kupit-dom" },
  {
    label: "Купить коммерцию в Краснодаре",
    href: "/krasnodar/kupit-kommercheskuyu-nedvizhimost",
  },
];

/**
 * Dark navy footer — one of the two or three dark bands the design allows per
 * page (hero + footer).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * «Популярные запросы» LIVES HERE NOW — this REVERSES the former "Conflict C".
 *
 * An earlier note in this file argued the SEO links must stay a homepage-only
 * section because footering them would put them on all 32 pages and change the
 * internal link graph. That trade-off was re-examined against the design files
 * and the sitewide placement was chosen deliberately: the kit puts them in the
 * footer in BOTH `ui_kits/website/index.html` and `components/navigation/
 * footer.card.html`, and the links are canonical indexable landing routes, so
 * sitewide internal links to them are an SEO gain, not a leak. The old
 * `SeoLinksFooter` homepage section is gone. Do not reintroduce it.
 *
 * FOOTER IS FULL-BLEED WITH SQUARE CORNERS — verified, do not "fix" this.
 * It was once reported as a rounded card inset from the page edges. It is not:
 * `.ctr-footer` in the design carries no border-radius, no margin and no
 * max-width, and measuring the rendered kit gives left=0, width=1440,
 * border-radius 0px at a 1440 viewport (same in `mobile.html`). The inset
 * belongs to the INNER container (`.ctr-footer__in`, max-width 1200 + 24px
 * padding), which is what `Container` provides below. The rounded-card
 * impression came from `footer.card.html`, a component-preview page that frames
 * the footer in a white padded body.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    /* margin-top is the design's `.foot` rule (84px desktop / 48px mobile). It
       is the ONLY space below the last section, because sections carry top-only
       padding (`.ctr-sec`) — the two are a pair, change them together.
       `mt-auto` is not needed: <main> is `flex-1`, so it already absorbs the
       free space on short pages. */
    <footer className="mt-12 bg-surface-dark text-white/72 md:mt-21">
      <Container>
        {/* 36/16/24 mobile → 56/24/28 desktop; the horizontal 16/24 comes from
            Container's own gutters, which already match the design. */}
        <div className="pt-9 pb-6 md:pt-14 md:pb-7">
          {/* Three zones: brand (1.4fr) | queries col 1 | queries col 2.
              Collapses to one column below sm, per the kit's 640px query. */}
          <div className="grid gap-7 border-b border-white/12 pb-10 sm:grid-cols-[1.4fr_1fr_1fr] sm:gap-10">
            <div>
              <Link href="/" className="inline-block">
                <Wordmark inverse />
              </Link>
              <p className="mt-3.5 max-w-[300px] text-small text-white/72">
                Недвижимость в Краснодаре и Геленджике: квартиры, дома, участки и
                коммерческие помещения.
              </p>
            </div>

            {/*
             * Spans BOTH link columns and splits internally, rather than being
             * two sibling grid cells.
             *
             * This is what removes the design's `&nbsp;` placeholder label: with
             * one spanning block there is only ONE label, so the second column
             * has no empty heading to fake. The geometry is identical — the
             * spanning cell is `1fr + 40px + 1fr` and its inner two columns use
             * the same 40px gap, so each resolves to exactly 1fr — and it is
             * better semantics: one named nav containing one list, instead of a
             * list split across two unlabelled cells.
             */}
            <nav
              aria-label="Популярные запросы"
              className="sm:col-span-2"
            >
              <p className="mb-3 text-caption uppercase tracking-[0.06em] text-white/50">
                Популярные запросы
              </p>
              <ul className="grid gap-x-10 sm:grid-cols-2">
                {popularQueries.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block py-[5px] text-small text-white/72 transition-colors duration-150 ease-out hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Bottom row: copyright left, legal/nav links inline right. Wraps on
              narrow screens instead of stacking into a labelled column — there
              is no «Разделы» heading in the design. */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-6 text-[13px] leading-[18px] text-white/55">
            <span>© {year} Centreal. Краснодарский край.</span>
            <nav aria-label="Правовая информация">
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {legalLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-white/55 transition-colors duration-150 ease-out hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </Container>
    </footer>
  );
}
