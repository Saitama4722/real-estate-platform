import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import {
  DistrictsExplorer,
  type DistrictFacetChip,
} from "@/components/districts/DistrictsExplorer";
import { districtsIndexCanonicalUrl } from "@/lib/districtGuideSeo";
import {
  DISTRICT_CITY_OPTIONS,
  DISTRICT_KIND_OPTIONS,
  DISTRICT_OVERVIEW_SLUGS,
  DISTRICTS_PAGE_SIZE,
  districtFacetCounts,
  filterGuides,
  parseDistrictsUiState,
  type DistrictsPageSearchRecord,
} from "@/lib/districtFilters";
import {
  districtGuideCardDataFrom,
  fetchPublicDistrictGuidesList,
} from "@/lib/publicDistrictGuides";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Районы Краснодара и Геленджика — гид по районам | Centreal",
    description:
      "Гиды по районам и микрорайонам Краснодара и Геленджика: чем живёт каждый район, кому подойдёт и где посмотреть объекты. Помогаем выбрать место для покупки.",
    alternates: { canonical: districtsIndexCanonicalUrl() },
  };
}

interface DistrictsPageProps {
  searchParams: Promise<DistrictsPageSearchRecord>;
}

export default async function DistrictsPage({ searchParams }: DistrictsPageProps) {
  const sp = await searchParams;
  const uiState = parseDistrictsUiState(sp);
  const all = await fetchPublicDistrictGuidesList();

  /*
   * Each facet's counts are narrowed by the OTHER facet's active value, so a
   * chip always predicts what clicking it yields. «Все» counts everything the
   * other facet still allows.
   */
  const cityCounts = districtFacetCounts(all, "city", uiState.kind);
  const kindCounts = districtFacetCounts(all, "kind", uiState.city);
  const cityChips: DistrictFacetChip[] = [
    {
      value: "",
      label: "Все",
      count: [...cityCounts.values()].reduce((a, b) => a + b, 0),
    },
    ...DISTRICT_CITY_OPTIONS.map((o) => ({
      value: o.value,
      label: o.label,
      count: cityCounts.get(o.value) ?? 0,
    })),
  ];
  const kindChips: DistrictFacetChip[] = [
    {
      value: "",
      label: "Все",
      count: [...kindCounts.values()].reduce((a, b) => a + b, 0),
    },
    ...DISTRICT_KIND_OPTIONS.map((o) => ({
      value: o.value,
      label: o.label,
      count: kindCounts.get(o.value) ?? 0,
    })),
  ];

  const filtered = filterGuides(all, uiState);

  /*
   * The lead cards are the CITY OVERVIEW guides — the real entry points into
   * each city. "Newest" would be meaningless here: every guide was published
   * the same day. They lead only while the reader is choosing a place (no kind
   * filter) on page 1; picking a kind means slicing by type, where an overview
   * is just another result. A featured guide is excluded from the grid so it
   * never appears twice.
   *
   * ⚠ The exclusion is NOT page-gated, only the RENDER is. Deciding
   * `gridSource` per page would give page 1 and page 2 different source lists,
   * so the slice boundaries slide and cards duplicate or vanish across the
   * page break [measured: page 2 showed 10 cards instead of 8].
   */
  const hasLeads = !uiState.kind;
  const featuredGuides = hasLeads
    ? filtered.filter((g) => DISTRICT_OVERVIEW_SLUGS.includes(g.slug))
    : [];
  const featuredSlugs = new Set(featuredGuides.map((g) => g.slug));
  const gridSource = filtered.filter((g) => !featuredSlugs.has(g.slug));

  const totalPages = Math.max(1, Math.ceil(gridSource.length / DISTRICTS_PAGE_SIZE));
  // A stale or hand-edited ?page clamps to the last real page.
  uiState.page = Math.min(uiState.page, totalPages);
  const pageItems = gridSource
    .slice(
      (uiState.page - 1) * DISTRICTS_PAGE_SIZE,
      uiState.page * DISTRICTS_PAGE_SIZE,
    )
    .map(districtGuideCardDataFrom);

  return (
    <div className="pb-2">
      <section className="ctr-sec pt-10 md:pt-[72px]">
        <Container>
          <p className="inline-flex items-center gap-2 text-caption font-bold tracking-[0.1em] uppercase text-brand">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-sm bg-accent" />
            Гид по районам
          </p>
          <h1 className="mt-3.5 text-[clamp(36px,5vw,54px)] leading-[1.05] font-extrabold tracking-[-0.03em] text-fg">
            Районы
          </h1>
          <p className="mt-4 max-w-[540px] text-[clamp(15px,1.3vw,17px)] leading-[1.6] text-pretty text-fg-muted">
            Районы и микрорайоны Краснодара и Геленджика: чем живёт каждый,
            кому подойдёт и где посмотреть объекты.
          </p>

          <DistrictsExplorer
            uiState={uiState}
            cityChips={cityChips}
            kindChips={kindChips}
            /* Rendered on page 1 only; the exclusion above applies to every
               page so the slice boundaries never move. */
            featured={
              uiState.page === 1 ? featuredGuides.map(districtGuideCardDataFrom) : []
            }
            items={pageItems}
            totalPages={totalPages}
          />
        </Container>
      </section>
    </div>
  );
}
