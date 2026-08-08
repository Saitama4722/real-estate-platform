import Link from "next/link";
import { ArticleCard, type ArticleCardData } from "@/components/articles/ArticleCard";
import { Icon, Icons } from "@/components/ui/icon";

/**
 * «Другие статьи» on the article detail page — full-width below the reading
 * column, same-category articles first (see getSimilarArticles). Uses THE
 * shared ArticleCard, never a private card variant.
 */

interface ArticleSimilarSectionProps {
  articles: ArticleCardData[];
}

export function ArticleSimilarSection({ articles }: ArticleSimilarSectionProps) {
  if (articles.length === 0) return null;

  return (
    <section className="ctr-sec">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h2 className="text-[clamp(24px,2.4vw,30px)] leading-[1.2] font-extrabold tracking-[-0.02em] text-fg">
            Другие статьи
          </h2>
          <p className="mt-2.5 text-[15px] leading-[1.6] text-fg-muted">
            Подборка материалов по недвижимости в Краснодарском крае.
          </p>
        </div>
        <Link
          href="/articles"
          className="inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-brand transition-colors duration-[150ms] hover:text-brand-hover focus-ring-brand"
        >
          Все статьи
          <Icon icon={Icons.ArrowRight} size={16} className="h-[15px] w-[15px]" />
        </Link>
      </div>
      <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </div>
    </section>
  );
}
