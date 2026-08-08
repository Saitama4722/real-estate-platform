import Link from "next/link";
import { Icon, Icons } from "@/components/ui/icon";
import { formatArticleDate } from "@/lib/articleContent";
import type { ArticleCardData } from "@/components/articles/ArticleCard";
import { cn } from "@/lib/utils";

/**
 * Featured article — the dark full-width card above the /articles grid.
 * Shown only for «Все» on page 1; the featured article is the NEWEST one and
 * is excluded from the grid below (mockup behaviour, driven by real data —
 * there is no "pinned" flag).
 *
 * Navy is --color-surface-dark, the same base as the site footer/hero — the
 * mockup's #0F172A is not introduced as a second dark (see the realtor-page
 * token note in globals.css).
 */

interface ArticleFeaturedCardProps {
  article: ArticleCardData;
  /**
   * "half" is the side-by-side lead used on /districts, where BOTH city
   * overviews lead the page. Additive: "full" is unchanged, so /articles keeps
   * the exact mockup proportions.
   */
  size?: "full" | "half";
}

export function ArticleFeaturedCard({
  article,
  size = "full",
}: ArticleFeaturedCardProps) {
  const half = size === "half";
  return (
    <Link
      href={article.href}
      /* Transition names `translate`, NOT `transform` — the v4 lift trap; see
         ArticleCard. */
      className={cn(
        "group relative mt-7 block overflow-hidden rounded-[20px] bg-surface-dark p-7 text-white transition-[box-shadow,translate] duration-[200ms] ease-out hover:-translate-y-[3px] hover:shadow-article-featured-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-ring-brand",
        half ? "flex h-full flex-col md:p-9" : "md:p-[52px]",
      )}
    >
      <div className={cn("relative z-[1]", half ? "flex flex-1 flex-col" : "max-w-[720px]")}>
        <div className="flex flex-wrap items-center gap-3">
          {article.eyebrow && (
            <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.1em] uppercase text-blue-300">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-accent"
              />
              {article.eyebrow}
            </span>
          )}
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-white/30" />
          {/* white/70, not the mockup's /55 — the meta row must clear AA on navy. */}
          <span className="text-[12.5px] text-white/70">
            <time dateTime={article.publishedAt}>
              {formatArticleDate(article.publishedAt)}
            </time>
            {" · "}
            {article.minutes} мин чтения
          </span>
        </div>

        <h2
          className={cn(
            "mt-[18px] leading-[1.15] font-extrabold tracking-[-0.02em] text-pretty text-white",
            half
              ? "text-[clamp(22px,2.2vw,28px)]"
              : "text-[clamp(26px,3.2vw,40px)]",
          )}
        >
          {article.title}
        </h2>

        <p
          className={cn(
            "mt-4 leading-[1.65] text-white/70",
            half ? "text-[15px]" : "max-w-[620px] text-body",
          )}
        >
          {article.excerpt}
        </p>

        <span
          aria-hidden="true"
          className={cn(
            "inline-flex items-center gap-2 self-start rounded-lg bg-brand px-5 py-3 text-[15px] font-semibold text-white transition-colors duration-[150ms] group-hover:bg-brand-hover",
            half ? "mt-6" : "mt-7",
          )}
        >
          {article.ctaLabel ?? "Читать статью"}
          <Icon icon={Icons.ArrowRight} size={16} />
        </span>
      </div>

      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute right-4 font-article-serif leading-none text-white/5 select-none",
          half ? "-top-6 text-[190px]" : "-top-10 text-[300px]",
        )}
      >
        «»
      </span>
    </Link>
  );
}
