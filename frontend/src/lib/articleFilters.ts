/**
 * Articles index state — the URL is the single source of truth (same pattern
 * as lib/catalogFilters.ts). The active category and the page number live in
 * the /articles query string; this module is the one place that parses and
 * serializes them, so chips, the grid, pagination links and the empty state
 * can never drift apart on param names.
 *
 * Category slugs mirror backend/articles/choices.py ArticleCategory VALUES —
 * they double as the ?category= param, so treat the list as append-only.
 */

export interface ArticleCategoryOption {
  slug: string;
  label: string;
}

export const ARTICLE_CATEGORIES: ArticleCategoryOption[] = [
  { slug: "pokupka", label: "Покупка" },
  { slug: "prodazha", label: "Продажа" },
  { slug: "ipoteka-i-finansy", label: "Ипотека и финансы" },
  { slug: "rayony-i-lokacii", label: "Районы и локации" },
  { slug: "investicii", label: "Инвестиции" },
  { slug: "yuridicheskie-voprosy", label: "Юридические вопросы" },
];

export function articleCategoryLabel(slug: string): string | undefined {
  return ARTICLE_CATEGORIES.find((c) => c.slug === slug)?.label;
}

/**
 * 14 per page — one full pass of the card-span rhythm
 * [3,3,2,2,2,3,3,2,2,2,3,3,3,3] on the desktop 6-column grid, so every full
 * page ends on a completed row. Page 1 of «Все» additionally shows the newest
 * article as the featured card above the grid.
 */
export const ARTICLES_PAGE_SIZE = 14;

export interface ArticlesUiState {
  /** Category slug, or "" for «Все». */
  category: string;
  /** 1-based. */
  page: number;
}

export type ArticlesPageSearchRecord = Record<
  string,
  string | string[] | undefined
>;

function firstParam(
  sp: ArticlesPageSearchRecord,
  key: string,
): string | undefined {
  const v = sp[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

function coerceCategory(raw: string | undefined): string {
  if (!raw) return "";
  return ARTICLE_CATEGORIES.some((c) => c.slug === raw) ? raw : "";
}

function coercePage(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const n = parseInt(raw, 10);
  return n >= 1 ? n : 1;
}

export function parseArticlesUiState(
  sp: ArticlesPageSearchRecord,
): ArticlesUiState {
  return {
    category: coerceCategory(firstParam(sp, "category")),
    page: coercePage(firstParam(sp, "page")),
  };
}

/** Defaults are omitted so the canonical URL stays a bare /articles. */
export function articlesUiStateToQuery(state: ArticlesUiState): string {
  const q = new URLSearchParams();
  if (state.category) q.set("category", state.category);
  if (state.page > 1) q.set("page", String(state.page));
  return q.toString();
}

export function articlesHref(state: ArticlesUiState): string {
  const qs = articlesUiStateToQuery(state);
  return qs ? `/articles?${qs}` : "/articles";
}

/** Chip counts are computed from the real list — never hardcode them. */
export function articleCategoryCounts(
  articles: { category: string }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const a of articles) {
    counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
  }
  return counts;
}
