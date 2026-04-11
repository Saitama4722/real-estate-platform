import type { PublicArticle } from "@/lib/publicArticles";
import { ArticlePreviewCard } from "@/components/articles/ArticlePreviewCard";

interface ArticleSimilarSectionProps {
  articles: PublicArticle[];
}

export function ArticleSimilarSection({ articles }: ArticleSimilarSectionProps) {
  if (articles.length === 0) return null;

  return (
    <section className="mt-10 border-t border-gray-200 pt-10">
      <h2 className="text-xl font-semibold text-gray-900">Другие статьи</h2>
      <p className="mt-1 text-sm text-gray-600">
        Подборка материалов по недвижимости в Краснодарском крае.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticlePreviewCard key={article.slug} article={article} />
        ))}
      </div>
    </section>
  );
}
