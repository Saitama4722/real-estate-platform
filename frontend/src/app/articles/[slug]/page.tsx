import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Icon, Icons } from "@/components/ui/icon";
import { ArticleBodyRenderer } from "@/components/articles/ArticleBodyRenderer";
import { ArticleCatalogCta } from "@/components/articles/ArticleCatalogCta";
import { ArticleProgressBar } from "@/components/articles/ArticleProgressBar";
import { ArticleShareRow } from "@/components/articles/ArticleShareRow";
import { ArticleSimilarSection } from "@/components/articles/ArticleSimilarSection";
import { ArticleToc } from "@/components/articles/ArticleToc";
import { ArticleTocAccordion } from "@/components/articles/ArticleTocAccordion";
import { articleCardDataFrom } from "@/components/articles/ArticleCard";
import { literata } from "@/app/articles/fonts";
import {
  computeReadingTimeMinutes,
  formatArticleDate,
  parseArticleBody,
} from "@/lib/articleContent";
import { articleCategoryLabel, articlesHref } from "@/lib/articleFilters";
import {
  fetchPublicArticleBySlug,
  fetchPublicArticlesList,
  getSimilarArticles,
} from "@/lib/publicArticles";
import {
  articleCanonicalUrl,
  buildArticleDocumentTitle,
  buildArticleJsonLd,
  buildArticleMetaDescription,
} from "@/lib/articleSeo";
import { JsonLd } from "@/components/seo/JsonLd";
import { isPropertyImageUrl } from "@/lib/propertyMedia";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchPublicArticleBySlug(slug);
  if (!article) {
    return { title: "Статья не найдена" };
  }

  return {
    title: buildArticleDocumentTitle(article),
    description: buildArticleMetaDescription(article),
    alternates: { canonical: articleCanonicalUrl(article.slug) },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const [article, allArticles] = await Promise.all([
    fetchPublicArticleBySlug(slug),
    fetchPublicArticlesList(),
  ]);
  if (!article) {
    notFound();
  }

  const similar = getSimilarArticles(
    article.slug,
    allArticles,
    3,
    article.category,
  ).map(articleCardDataFrom);
  const jsonLd = buildArticleJsonLd(article);
  const parsed = parseArticleBody(article.body);
  const minutes = computeReadingTimeMinutes(article.body);
  const categoryLabel = articleCategoryLabel(article.category);
  const canonicalUrl = articleCanonicalUrl(article.slug);
  const showCover = Boolean(
    article.coverImage && isPropertyImageUrl(article.coverImage),
  );

  return (
    /* literata.variable defines --font-literata for this subtree only, and
       ctr-article-serif-scope re-declares --font-article-serif HERE so the
       self-hosted face actually joins the stack (at :root the token cannot see
       the page-scoped font variable — see globals.css). Serif stays scoped to
       the article body; header/footer/cards remain Golos. */
    <div className={`${literata.variable} ctr-article-serif-scope`}>
      <JsonLd data={jsonLd} />
      <ArticleProgressBar targetId="article-body" />

      <Container>
        <div className="min-[1140px]:grid min-[1140px]:grid-cols-[minmax(40px,1fr)_minmax(0,680px)_264px] min-[1140px]:gap-x-14">
          <div className="mx-auto w-full max-w-[720px] min-[1140px]:col-start-2 min-[1140px]:mx-0 min-[1140px]:max-w-none">
            <section className="ctr-sec pt-8 md:pt-[60px]">
              <Breadcrumbs
                tone="strong"
                items={[
                  { label: "Главная", href: "/" },
                  { label: "Статьи", href: "/articles" },
                  { label: article.title },
                ]}
              />

              <div
                aria-hidden="true"
                className="mt-7 mb-[22px] h-[3px] w-11 rounded-sm bg-accent md:mt-11"
              />

              <article>
                {categoryLabel && (
                  <Link
                    href={articlesHref({ category: article.category, page: 1 })}
                    className="inline-flex rounded-full bg-brand-tint px-3.5 py-1.5 text-caption font-bold tracking-[0.08em] uppercase text-brand transition-colors duration-[150ms] hover:bg-brand-tint-2 focus-ring-brand"
                  >
                    {categoryLabel}
                  </Link>
                )}

                <h1 className="mt-[18px] max-w-[760px] text-[clamp(32px,4.4vw,52px)] leading-[1.12] font-extrabold tracking-[-0.025em] text-pretty text-fg">
                  {article.title}
                </h1>

                <div className="mt-6 flex flex-wrap gap-x-[22px] gap-y-2.5 text-small text-fg-muted">
                  <span className="inline-flex items-center gap-[7px]">
                    <Icon icon={Icons.Calendar} size={16} className="h-[15px] w-[15px]" />
                    <time dateTime={article.publishedAt}>
                      Опубликовано {formatArticleDate(article.publishedAt)}
                    </time>
                  </span>
                  <span className="inline-flex items-center gap-[7px]">
                    <Icon icon={Icons.Clock} size={16} className="h-[15px] w-[15px]" />
                    {minutes} мин чтения
                  </span>
                </div>

                {showCover && (
                  <div className="mt-9 aspect-[21/9] w-full overflow-hidden rounded-[20px] bg-surface-inset">
                    <img
                      src={article.coverImage as string}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                <div
                  aria-hidden="true"
                  className="mt-8 h-px bg-border md:mt-[52px]"
                />

                {/* Tablet-only collapsible TOC (md → <1140); below md no TOC.
                    Stacked md:max-[1139px] variant instead of md:block +
                    min-[1140px]:hidden — the pair has equal specificity, so
                    which wins would depend on stylesheet order. */}
                <div className="hidden md:max-[1139px]:block">
                  <ArticleTocAccordion entries={parsed.toc} />
                </div>

                <ArticleBodyRenderer parsed={parsed} />

                <ArticleShareRow url={canonicalUrl} title={article.title} />

                <ArticleCatalogCta />
              </article>
            </section>
          </div>

          <aside className="hidden min-[1140px]:col-start-3 min-[1140px]:block min-[1140px]:pt-[220px]">
            <ArticleToc entries={parsed.toc} />
          </aside>
        </div>

        <ArticleSimilarSection articles={similar} />
      </Container>
    </div>
  );
}
