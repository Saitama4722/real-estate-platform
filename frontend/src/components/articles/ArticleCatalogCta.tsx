import Link from "next/link";
import { Icon, Icons } from "@/components/ui/icon";
import { ARTICLE_PAGE_CATALOG_LINKS } from "@/lib/articleCatalogLinks";

/**
 * Dark catalog CTA card closing the reading column (replaces the old
 * ArticleCatalogLinksBlock). Defaults are the article version: primary button
 * to /catalog, ghost pills from the deterministic SEO-landing list in
 * lib/articleCatalogLinks.ts — the first entry there IS /catalog, which the
 * button already covers, hence slice(1).
 *
 * A district guide passes its own copy and an area-filtered catalog href, so
 * the reader lands on listings for THAT district rather than the whole
 * catalogue. Same component, different data — no second CTA card.
 */
interface ArticleCatalogCtaProps {
  title?: string;
  description?: string;
  primaryHref?: string;
  primaryLabel?: string;
  /** Ghost link pills; pass [] to render none. */
  links?: { label: string; href: string }[];
  /** Decorative watermark glyph. */
  glyph?: string;
}

export function ArticleCatalogCta({
  title = "Каталог недвижимости",
  description = "Квартиры, дома и участки в Краснодаре и Геленджике — с проверкой документов и сопровождением сделки.",
  primaryHref = "/catalog",
  primaryLabel = "Открыть каталог",
  links,
  glyph = "К",
}: ArticleCatalogCtaProps = {}) {
  const pills = links ?? ARTICLE_PAGE_CATALOG_LINKS.slice(1);

  return (
    <section className="relative mt-11 overflow-hidden rounded-[20px] bg-surface-dark p-7 font-sans text-white md:p-11">
      <div className="relative z-[1]">
        <h2 className="text-[clamp(21px,2.2vw,26px)] leading-[1.2] font-extrabold tracking-[-0.02em]">
          {title}
        </h2>
        <p className="mt-3 max-w-[480px] text-[15px] leading-[1.6] text-white/70">
          {description}
        </p>
        <Link
          href={primaryHref}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-[13px] text-[14.5px] font-semibold text-white transition-colors duration-[150ms] hover:bg-brand-hover focus-ring-brand"
        >
          {primaryLabel}
          <Icon icon={Icons.ArrowRight} size={16} className="h-[15px] w-[15px]" />
        </Link>
        <div className="mt-5 flex flex-wrap gap-2">
          {pills.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-10 items-center rounded-full border border-white/20 px-[15px] py-2 text-[13.5px] font-medium text-white/85 transition-colors duration-[150ms] hover:border-white/50 hover:bg-white/5 hover:text-white focus-ring-brand"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 -bottom-14 font-article-serif text-[220px] leading-none text-white/[0.04] select-none"
      >
        {glyph}
      </span>
    </section>
  );
}
