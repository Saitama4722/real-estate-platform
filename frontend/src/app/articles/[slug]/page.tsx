import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCatalogCta } from "@/components/articles/ArticleCatalogCta";
import { ArticleReadingPage } from "@/components/articles/ArticleReadingPage";
import { ArticleSimilarSection } from "@/components/articles/ArticleSimilarSection";
import { articleCardDataFrom } from "@/components/articles/ArticleCard";
import {
  computeReadingTimeMinutes,
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

  return (
    <>
      <JsonLd data={buildArticleJsonLd(article)} />
      <ArticleReadingPage
        breadcrumbs={[
          { label: "Главная", href: "/" },
          { label: "Статьи", href: "/articles" },
          { label: article.title },
        ]}
        eyebrow={articleCategoryLabel(article.category)}
        eyebrowHref={articlesHref({ category: article.category, page: 1 })}
        title={article.title}
        publishedAt={article.publishedAt}
        minutes={computeReadingTimeMinutes(article.body)}
        coverImage={article.coverImage}
        parsed={parseArticleBody(article.body)}
        shareUrl={articleCanonicalUrl(article.slug)}
        cta={<ArticleCatalogCta />}
        after={<ArticleSimilarSection articles={similar} />}
      />
    </>
  );
}
