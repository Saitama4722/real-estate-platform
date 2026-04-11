import { getPublicApiBaseUrl } from "@/lib/publicProperty";

export interface PublicArticle {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  publishedAt: string;
  coverImage: string | null;
}

interface ArticleRaw {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  published_at: string;
  cover_image: string | null;
}

function mapArticleRaw(row: ArticleRaw): PublicArticle {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    publishedAt: row.published_at,
    coverImage: row.cover_image,
  };
}

function normalizeArticleList(data: unknown): ArticleRaw[] {
  if (Array.isArray(data)) return data as ArticleRaw[];
  if (data && typeof data === "object" && "results" in data) {
    const r = (data as { results?: unknown }).results;
    if (Array.isArray(r)) return r as ArticleRaw[];
  }
  return [];
}

export async function fetchPublicArticlesList(): Promise<PublicArticle[]> {
  const url = `${getPublicApiBaseUrl()}/articles/`;
  try {
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (!res.ok) {
      console.error("[fetchPublicArticlesList] HTTP", res.status, url);
      return [];
    }
    const raw = await res.json();
    return normalizeArticleList(raw).map(mapArticleRaw);
  } catch (e) {
    console.error("[fetchPublicArticlesList]", url, e);
    return [];
  }
}

export async function fetchPublicArticleBySlug(
  slug: string,
): Promise<PublicArticle | null> {
  const enc = encodeURIComponent(slug.trim());
  const url = `${getPublicApiBaseUrl()}/articles/${enc}/`;
  try {
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error("[fetchPublicArticleBySlug] HTTP", res.status, url);
      return null;
    }
    return mapArticleRaw((await res.json()) as ArticleRaw);
  } catch (e) {
    console.error("[fetchPublicArticleBySlug]", url, e);
    return null;
  }
}

export function listArticlesSorted(articles: PublicArticle[]): PublicArticle[] {
  return [...articles].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

export function getSimilarArticles(
  slug: string,
  articles: PublicArticle[],
  limit = 3,
): PublicArticle[] {
  const key = slug.trim();
  return listArticlesSorted(articles)
    .filter((a) => a.slug !== key)
    .slice(0, limit);
}
