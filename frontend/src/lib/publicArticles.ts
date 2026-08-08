import { getPublicApiBaseUrl } from "@/lib/publicProperty";

export interface PublicArticleSection {
  heading: string;
  text: string;
}

export interface PublicArticle {
  slug: string;
  title: string;
  excerpt: string;
  /** Opening paragraphs, rendered under the H1 with no subheading. */
  intro: string;
  /** Subheaded sections in reading order; the API drops empty ones. */
  sections: PublicArticleSection[];
  /** Heading of the «Главное» card — a field, so «Совет» survives. */
  conclusionTitle: string;
  /** Text of the «Главное» card; empty means no card. */
  conclusion: string;
  /** ArticleCategory slug ("" only for a stale cached payload without it). */
  category: string;
  publishedAt: string;
  coverImage: string | null;
}

interface ArticleRaw {
  slug: string;
  title: string;
  excerpt: string;
  intro?: string;
  sections?: PublicArticleSection[];
  conclusion_title?: string;
  conclusion?: string;
  category?: string;
  published_at: string;
  cover_image: string | null;
}

function mapArticleRaw(row: ArticleRaw): PublicArticle {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    // Defaulted, not required: a cached payload from before the structured
    // fields shipped would otherwise render `undefined` into the page.
    intro: row.intro ?? "",
    sections: row.sections ?? [],
    conclusionTitle: row.conclusion_title ?? "Вывод",
    conclusion: row.conclusion ?? "",
    category: row.category ?? "",
    publishedAt: row.published_at,
    coverImage: row.cover_image,
  };
}

/** The article's content as the shared section pipeline consumes it. */
export function articleSections(article: PublicArticle) {
  return [
    { heading: null, text: article.intro },
    ...article.sections.map((s) => ({ heading: s.heading, text: s.text })),
  ];
}

export function articleTakeaway(article: PublicArticle) {
  return { title: article.conclusionTitle, text: article.conclusion };
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

/**
 * «Другие статьи»: same-category articles first (newest first), then the rest
 * by recency. Pass the current article's category so a reader deep in
 * «Ипотека» sees mortgage material before generic news.
 */
export function getSimilarArticles(
  slug: string,
  articles: PublicArticle[],
  limit = 3,
  category?: string,
): PublicArticle[] {
  const key = slug.trim();
  const others = listArticlesSorted(articles).filter((a) => a.slug !== key);
  if (!category) return others.slice(0, limit);
  const same = others.filter((a) => a.category === category);
  const rest = others.filter((a) => a.category !== category);
  return [...same, ...rest].slice(0, limit);
}
