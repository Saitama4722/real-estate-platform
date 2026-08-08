import Link from "next/link";
import { Icon, Icons } from "@/components/ui/icon";
import {
  computeReadingTimeMinutes,
  formatArticleDate,
} from "@/lib/articleContent";
import { articleCategoryLabel } from "@/lib/articleFilters";
import type { PublicArticle } from "@/lib/publicArticles";
import { cn } from "@/lib/utils";

/**
 * THE article card (articles mockup) — used by the /articles grid, the
 * «Другие статьи» block on the detail page and the homepage «Статьи» section.
 * One component, one style; do not fork per surface.
 *
 * Text-only by design: the mockup's card system has no image slot, which
 * matches the data (covers are optional and currently absent everywhere).
 *
 * `size="lg"` is the desktop span-3 card: bigger title plus the decorative
 * ghost letter. Both differences apply from `lg:` only — below the 6-column
 * grid every card renders identically, exactly as in the mockup.
 */

export interface ArticleCardData {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  minutes: number;
}

/** Server-side projection — strips `body` so full texts never ship as props. */
export function articleCardDataFrom(article: PublicArticle): ArticleCardData {
  return {
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    category: article.category,
    publishedAt: article.publishedAt,
    minutes: computeReadingTimeMinutes(article.body),
  };
}

interface ArticleCardProps {
  article: ArticleCardData;
  size?: "md" | "lg";
  className?: string;
}

export function ArticleCard({ article, size = "md", className }: ArticleCardProps) {
  const categoryLabel = articleCategoryLabel(article.category);

  return (
    <Link
      href={`/articles/${article.slug}`}
      /* The WHOLE card is one link — safe because an article card contains no
         nested interactive elements (see ArticlesSection for the precedent).
         Transition names `translate`, NOT `transform`: in Tailwind v4 the lift
         compiles to the `translate` property, and a transition list naming
         `transform` would snap instead of easing. */
      className={cn(
        "group relative flex flex-col gap-[13px] overflow-hidden rounded-2xl border border-border bg-surface-raised p-6 text-fg",
        "transition-[box-shadow,translate,border-color] duration-[200ms] ease-out",
        "hover:-translate-y-[3px] hover:border-brand-tint-2 hover:shadow-article-card-hover",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        "focus-ring-brand",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {categoryLabel ? (
          <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-brand">
            {categoryLabel}
          </span>
        ) : (
          <span aria-hidden="true" />
        )}
        {/* fg-muted, not the mockup's #94A3B8: readable meta must clear AA. */}
        <span className="inline-flex items-center gap-1.5 text-caption font-normal text-fg-muted">
          <Icon icon={Icons.Clock} size={16} className="h-[13px] w-[13px]" />
          {article.minutes} мин
        </span>
      </div>

      <h3
        className={cn(
          "text-[17.5px] leading-[1.3] font-bold tracking-[-0.01em] text-pretty",
          size === "lg" && "lg:text-[21px]",
        )}
      >
        {article.title}
      </h3>

      <p className="line-clamp-3 text-[14.5px] leading-[1.6] text-fg-muted">
        {article.excerpt}
      </p>

      <div className="mt-auto flex items-center justify-between pt-1.5">
        <time className="text-[13px] text-fg-muted" dateTime={article.publishedAt}>
          {formatArticleDate(article.publishedAt)}
        </time>
        <span
          aria-hidden="true"
          className="inline-flex items-center gap-1.5 text-small font-semibold text-brand"
        >
          Читать
          <Icon icon={Icons.ArrowRight} size={16} className="h-[15px] w-[15px]" />
        </span>
      </div>

      {size === "lg" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2 -bottom-[30px] hidden font-article-serif text-[120px] leading-none font-semibold text-brand/[0.06] select-none lg:block"
        >
          {article.title.charAt(0)}
        </span>
      )}
    </Link>
  );
}
