import Link from "next/link";
import { Container } from "@/components/layout/container";

interface ArticleItem {
  slug: string;
  title: string;
  excerpt: string;
}

interface ArticlesSectionProps {
  articles: ArticleItem[];
}

export function ArticlesSection({ articles }: ArticlesSectionProps) {
  if (articles.length === 0) return null;

  return (
    <section className="py-10 md:py-12">
      <Container>
        <h2 className="text-2xl font-semibold text-gray-900">Статьи</h2>
        <div className="mt-5 grid gap-4 md:mt-6 md:grid-cols-3">
          {articles.map((article) => (
            <article
              key={article.slug}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <div className="h-32 bg-gray-200">
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  Статья
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-base font-semibold text-gray-900">
                  <Link
                    href={`/articles/${article.slug}`}
                    className="hover:text-blue-700 hover:underline"
                  >
                    {article.title}
                  </Link>
                </h3>
                <p className="mt-2 text-sm text-gray-600">{article.excerpt}</p>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
