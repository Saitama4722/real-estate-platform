import Link from "next/link";
import { Container } from "@/components/layout/container";
import { BreadcrumbItem, Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Icon, Icons } from "@/components/ui/icon";
import { CatalogExplorer } from "@/components/catalog/CatalogExplorer";
import { CatalogPropertyItem } from "@/components/catalog/types";
import type { CatalogPageSearchRecord } from "@/lib/catalogQueryParams";
import { catalogSearchParamFirst } from "@/lib/catalogQueryParams";
import {
  CATALOG_PAGE_SIZE,
  parseCatalogUiState,
} from "@/lib/catalogFilters";
import { fetchCatalogLocationData } from "@/lib/publicLocations";
import { sortCatalogProperties } from "@/lib/sortCatalogProperties";

interface CatalogSeoLink {
  label: string;
  href: string;
}

interface CatalogPageTemplateProps {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  subtitle?: string;
  properties: CatalogPropertyItem[];
  seoText: string;
  seoLinks: CatalogSeoLink[];
  /**
   * Query каталога. On /catalog these are the page's real searchParams; SEO
   * landing pages pass the record their route RESOLVES TO (city + type +
   * district…), so the panel pre-fills, chips reflect the route's filters,
   * and any interaction continues on /catalog with that state carried over.
   */
  catalogSearchParams?: CatalogPageSearchRecord;
  /** Fallback initial view when the query string carries no `view` param. */
  initialMapView?: boolean;
  /** Listings the Этаж preset dropped for an unknown building height. */
  hiddenUnknownFloors?: number;
}

/**
 * Shared by /catalog and the SEO landing routes. Server Component: it parses
 * the URL state, sorts the full result set and slices the current page, so a
 * filtered/sorted/paginated URL is fully server-rendered (SEO-relevant).
 *
 * Sorting note: «Сначала новые» / «Дешевле» / «Дороже» are also requested
 * from the API via ?ordering; the deterministic re-sort here makes «По
 * площади» work too (no API ordering field for area — documented limitation)
 * and keeps landing pages, whose list arrives pre-filtered, on the same path.
 */
export async function CatalogPageTemplate({
  breadcrumbs,
  title,
  subtitle,
  properties,
  seoText,
  seoLinks,
  catalogSearchParams,
  initialMapView,
  hiddenUnknownFloors = 0,
}: CatalogPageTemplateProps) {
  const sp = catalogSearchParams ?? {};
  const uiState = parseCatalogUiState(sp);
  if (!catalogSearchParamFirst(sp, "view") && initialMapView) {
    uiState.view = "map";
  }

  const sorted = sortCatalogProperties(properties, uiState.sort);
  const totalCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / CATALOG_PAGE_SIZE));
  // An out-of-range ?page (stale link, shrunken result set) clamps to the
  // last page rather than rendering an empty grid.
  uiState.page = Math.min(uiState.page, totalPages);
  const pageItems = sorted.slice(
    (uiState.page - 1) * CATALOG_PAGE_SIZE,
    uiState.page * CATALOG_PAGE_SIZE,
  );

  const locationData = await fetchCatalogLocationData();

  return (
    <div className="pb-16">
      <Container>
        <div className="pt-5 pb-5">
          {/* `strong` tone + fg-secondary subtitle: gray-500/fg-muted on the
              warm page background measure 4.49:1 — a hair under WCAG AA. */}
          <Breadcrumbs items={breadcrumbs} tone="strong" />
          <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.02em] text-fg md:text-[32px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-[14.5px] text-fg-secondary">{subtitle}</p>
          )}
        </div>

        <CatalogExplorer
          uiState={uiState}
          pageItems={pageItems}
          allItems={sorted}
          totalCount={totalCount}
          totalPages={totalPages}
          locationData={locationData}
          hiddenUnknownFloors={hiddenUnknownFloors}
        />

        <section
          aria-label="SEO-текст"
          className="mt-14 grid gap-10 border-t border-border pt-10 lg:grid-cols-2"
        >
          <div>
            <h2 className="text-[20px] font-bold tracking-tight text-fg">
              Недвижимость в Краснодарском крае
            </h2>
            <p className="mt-3 max-w-[58ch] text-pretty text-small leading-relaxed text-fg-secondary">
              {seoText}
            </p>
          </div>
          <div>
            <h3 className="text-caption font-semibold uppercase tracking-[0.08em] text-fg-muted">
              Похожие запросы
            </h3>
            <ul className="mt-3.5 grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {seoLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="group/l flex items-center gap-2 py-1.5 text-small font-medium text-fg transition-colors hover:text-brand"
                  >
                    <Icon
                      icon={Icons.ArrowRight}
                      size={16}
                      className="h-3.5 w-3.5 shrink-0 text-gray-300 transition-colors group-hover/l:text-brand"
                    />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </Container>
    </div>
  );
}
