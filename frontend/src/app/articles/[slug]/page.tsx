import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { PageHeading } from "@/components/layout/page-heading";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ArticleSimilarSection } from "@/components/articles/ArticleSimilarSection";
import { ArticleCatalogLinksBlock } from "@/components/articles/ArticleCatalogLinksBlock";
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

  const similar = getSimilarArticles(article.slug, allArticles, 3);
  const jsonLd = buildArticleJsonLd(article);

  return (
    <Container className="py-6">
      <JsonLd data={jsonLd} />
      <Breadcrumbs
        items={[
          { label: "Главная", href: "/" },
          { label: "Статьи", href: "/articles" },
          { label: article.title },
        ]}
        className="mb-4"
      />

      <article>
        <PageHeading title={article.title} />

        <p className="mt-2 text-sm text-gray-500">
          <time dateTime={article.publishedAt}>
            Опубликовано {formatDate(article.publishedAt)}
          </time>
        </p>

        <div className="mt-6 aspect-[16/9] w-full max-w-3xl overflow-hidden rounded-lg bg-gray-200">
          {article.coverImage && isPropertyImageUrl(article.coverImage) ? (
            <img
              src={article.coverImage}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-sm text-gray-500">
              Статья
            </div>
          )}
        </div>

        <div className="mt-8 max-w-3xl whitespace-pre-line text-base leading-relaxed text-gray-800">
          {article.body}
        </div>

        <ArticleCatalogLinksBlock />

        <ArticleSimilarSection articles={similar} />
      </article>
    </Container>
  );
}
