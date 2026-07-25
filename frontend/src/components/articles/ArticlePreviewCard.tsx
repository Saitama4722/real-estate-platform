import Link from "next/link";
import type { PublicArticle } from "@/lib/publicArticles";
import { isPropertyImageUrl } from "@/lib/propertyMedia";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface ArticlePreviewCardProps {
  article: PublicArticle;
}

export function ArticlePreviewCard({ article }: ArticlePreviewCardProps) {
  const href = `/articles/${article.slug}`;
  const hasCover = Boolean(article.coverImage && isPropertyImageUrl(article.coverImage));

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      {hasCover && (
        <div className="aspect-[16/10] w-full bg-gray-200">
          <img
            src={article.coverImage as string}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <time className="text-xs text-gray-500" dateTime={article.publishedAt}>
          {formatDate(article.publishedAt)}
        </time>
        <h2 className="mt-2 line-clamp-2 text-base font-semibold text-gray-900">
          <Link href={href} className="hover:text-gray-700">
            {article.title}
          </Link>
        </h2>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-gray-700">{article.excerpt}</p>
        <div className="mt-4 pt-2">
          <Link
            href={href}
            className="text-sm font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700"
          >
            Читать далее
          </Link>
        </div>
      </div>
    </article>
  );
}
