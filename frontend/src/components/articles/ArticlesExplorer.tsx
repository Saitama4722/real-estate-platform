"use client";

import {
  EditorialIndexExplorer,
  type EditorialFacet,
} from "@/components/editorial/EditorialIndexExplorer";
import type { ArticleCardData } from "@/components/articles/ArticleCard";
import { articlesHref, type ArticlesUiState } from "@/lib/articleFilters";

/**
 * /articles binding for the shared editorial index. One facet (category), one
 * lead card. All behaviour — chips, grid rhythm, pagination, empty state, the
 * URL/history idiom — lives in EditorialIndexExplorer, which /districts also
 * renders.
 *
 * This wrapper exists because the shared explorer takes FUNCTIONS (hrefOf,
 * apply, withPage) and functions cannot cross the RSC boundary. Keeping it a
 * client component lets the server page pass plain data only.
 */

export interface ArticleCategoryChip {
  /** "" = «Все». */
  slug: string;
  label: string;
  count: number;
}

interface ArticlesExplorerProps {
  uiState: ArticlesUiState;
  chips: ArticleCategoryChip[];
  /** Newest article, present only for «Все» page 1; excluded from `items`. */
  featured: ArticleCardData | null;
  items: ArticleCardData[];
  totalPages: number;
}

export function ArticlesExplorer({
  uiState,
  chips,
  featured,
  items,
  totalPages,
}: ArticlesExplorerProps) {
  const facets: EditorialFacet<ArticlesUiState>[] = [
    {
      key: "category",
      ariaLabel: "Фильтр по категориям",
      chips: chips.map((c) => ({
        value: c.slug,
        label: c.label,
        count: c.count,
      })),
      valueOf: (s) => s.category,
      apply: (_s, value) => ({ category: value, page: 1 }),
    },
  ];

  return (
    <EditorialIndexExplorer<ArticlesUiState>
      state={uiState}
      hrefOf={articlesHref}
      facets={facets}
      featured={featured ? [featured] : []}
      items={items}
      page={uiState.page}
      totalPages={totalPages}
      withPage={(s, page) => ({ ...s, page })}
      empty={{
        title: uiState.category
          ? `В категории «${chips.find((c) => c.slug === uiState.category)?.label ?? ""}» пока нет статей`
          : "Пока нет статей",
        body: uiState.category
          ? "Мы готовим материалы по этой теме. А пока посмотрите все статьи блога."
          : "Мы готовим полезные материалы о недвижимости — загляните чуть позже.",
        resetLabel: uiState.category ? "Показать все статьи" : undefined,
        resetTo: uiState.category ? () => ({ category: "", page: 1 }) : undefined,
      }}
      resultsId="articles-results"
    />
  );
}
