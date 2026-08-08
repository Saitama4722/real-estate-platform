import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { articleCardDataFrom } from "@/components/articles/ArticleCard";
import {
  ArticlesExplorer,
  type ArticleCategoryChip,
} from "@/components/articles/ArticlesExplorer";
import { articlesIndexCanonicalUrl } from "@/lib/articleSeo";
import {
  ARTICLE_CATEGORIES,
  ARTICLES_PAGE_SIZE,
  articleCategoryCounts,
  parseArticlesUiState,
  type ArticlesPageSearchRecord,
} from "@/lib/articleFilters";
import {
  fetchPublicArticlesList,
  listArticlesSorted,
} from "@/lib/publicArticles";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Статьи о недвижимости — Centreal",
    description:
      "Материалы Centreal о покупке квартир, домов и участков в Краснодаре и Геленджике: советы покупателю и обзор рынка.",
    alternates: { canonical: articlesIndexCanonicalUrl() },
  };
}

interface ArticlesPageProps {
  searchParams: Promise<ArticlesPageSearchRecord>;
}

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const sp = await searchParams;
  const uiState = parseArticlesUiState(sp);
  const all = listArticlesSorted(await fetchPublicArticlesList());

  const counts = articleCategoryCounts(all);
  const chips: ArticleCategoryChip[] = [
    { slug: "", label: "Все", count: all.length },
    ...ARTICLE_CATEGORIES.map((c) => ({
      slug: c.slug,
      label: c.label,
      count: counts.get(c.slug) ?? 0,
    })),
  ];

  const filtered = uiState.category
    ? all.filter((a) => a.category === uiState.category)
    : all;

  // «Все»: the newest article is the featured card and never appears in the
  // grid, so page boundaries stay stable across pages. Categories: no featured.
  const featuredArticle = !uiState.category && filtered.length > 0 ? filtered[0] : null;
  const gridSource = featuredArticle ? filtered.slice(1) : filtered;

  const totalPages = Math.max(1, Math.ceil(gridSource.length / ARTICLES_PAGE_SIZE));
  // An out-of-range ?page (stale link, shrunken category) clamps to the last page.
  uiState.page = Math.min(uiState.page, totalPages);
  const pageItems = gridSource
    .slice((uiState.page - 1) * ARTICLES_PAGE_SIZE, uiState.page * ARTICLES_PAGE_SIZE)
    .map(articleCardDataFrom);

  const featured =
    featuredArticle && uiState.page === 1 ? articleCardDataFrom(featuredArticle) : null;

  return (
    <div className="pb-2">
      <section className="ctr-sec pt-10 md:pt-[72px]">
        <Container>
          <p className="inline-flex items-center gap-2 text-caption font-bold tracking-[0.1em] uppercase text-brand">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-sm bg-accent" />
            Блог Centreal
          </p>
          <h1 className="mt-3.5 text-[clamp(36px,5vw,54px)] leading-[1.05] font-extrabold tracking-[-0.03em] text-fg">
            Статьи
          </h1>
          <p className="mt-4 max-w-[540px] text-[clamp(15px,1.3vw,17px)] leading-[1.6] text-pretty text-fg-muted">
            Полезные материалы о недвижимости в Краснодарском крае: покупка,
            продажа, ипотека, районы и инвестиции.
          </p>

          <ArticlesExplorer
            uiState={uiState}
            chips={chips}
            featured={featured}
            items={pageItems}
            totalPages={totalPages}
          />
        </Container>
      </section>
    </div>
  );
}
