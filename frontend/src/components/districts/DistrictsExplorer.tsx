"use client";

import {
  EditorialIndexExplorer,
  type EditorialFacet,
} from "@/components/editorial/EditorialIndexExplorer";
import type { ArticleCardData } from "@/components/articles/ArticleCard";
import {
  districtsHref,
  type DistrictsUiState,
} from "@/lib/districtFilters";

/**
 * /districts binding for the shared editorial index — the same component
 * /articles renders, with TWO facets instead of one and up to two lead cards.
 *
 * Client (not server) because the shared explorer takes functions, which
 * cannot cross the RSC boundary.
 */

export interface DistrictFacetChip {
  /** "" = «Все». */
  value: string;
  label: string;
  count: number;
}

interface DistrictsExplorerProps {
  uiState: DistrictsUiState;
  cityChips: DistrictFacetChip[];
  kindChips: DistrictFacetChip[];
  /** City overview guides leading the page; excluded from `items`. */
  featured: ArticleCardData[];
  items: ArticleCardData[];
  totalPages: number;
}

export function DistrictsExplorer({
  uiState,
  cityChips,
  kindChips,
  featured,
  items,
  totalPages,
}: DistrictsExplorerProps) {
  const facets: EditorialFacet<DistrictsUiState>[] = [
    {
      key: "city",
      label: "Город",
      ariaLabel: "Фильтр по городу",
      chips: cityChips,
      valueOf: (s) => s.city,
      // Page always resets: a narrowed result set invalidates the old page.
      apply: (s, value) => ({ ...s, city: value, page: 1 }),
    },
    {
      key: "kind",
      label: "Тип",
      ariaLabel: "Фильтр по типу района",
      chips: kindChips,
      valueOf: (s) => s.kind,
      apply: (s, value) => ({ ...s, kind: value, page: 1 }),
    },
  ];

  const filtered = Boolean(uiState.city || uiState.kind);

  return (
    <EditorialIndexExplorer<DistrictsUiState>
      state={uiState}
      hrefOf={districtsHref}
      facets={facets}
      featured={featured}
      items={items}
      page={uiState.page}
      totalPages={totalPages}
      withPage={(s, page) => ({ ...s, page })}
      empty={{
        title: "По этому фильтру гидов пока нет",
        body: "Мы описываем районы постепенно. Попробуйте другой город или тип — или посмотрите все гиды.",
        resetLabel: filtered ? "Показать все гиды" : undefined,
        resetTo: filtered ? () => ({ city: "", kind: "", page: 1 }) : undefined,
      }}
      resultsId="districts-results"
    />
  );
}
