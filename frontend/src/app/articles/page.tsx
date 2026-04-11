import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { PageHeading } from "@/components/layout/page-heading";
import { ArticlePreviewCard } from "@/components/articles/ArticlePreviewCard";
import { articlesIndexCanonicalUrl } from "@/lib/articleSeo";
import { fetchPublicArticlesList, listArticlesSorted } from "@/lib/publicArticles";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Статьи о недвижимости — Centreal",
    description:
      "Материалы Centreal о покупке квартир, домов и участков в Краснодаре и Геленджике: советы покупателю и обзор рынка.",
    alternates: { canonical: articlesIndexCanonicalUrl() },
  };
}

export default async function ArticlesPage() {
  const articles = listArticlesSorted(await fetchPublicArticlesList());

  return (
    <Container className="py-10">
      <PageHeading
        title="Статьи"
        subtitle="Полезные материалы о недвижимости в Краснодарском крае"
      />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticlePreviewCard key={article.slug} article={article} />
        ))}
      </div>
    </Container>
  );
}
