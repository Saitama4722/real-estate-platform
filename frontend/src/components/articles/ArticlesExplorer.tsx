"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useTransition,
} from "react";
import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import { ArticleCard, type ArticleCardData } from "@/components/articles/ArticleCard";
import { ArticleFeaturedCard } from "@/components/articles/ArticleFeaturedCard";
import { Icon, Icons } from "@/components/ui/icon";
import {
  articlesHref,
  type ArticlesUiState,
} from "@/lib/articleFilters";
import { cn } from "@/lib/utils";

/**
 * Client shell of the /articles index. The URL is the single source of truth:
 * every interaction (chip, pagination, empty-state reset) becomes a navigation
 * to a crawlable href — the server page re-filters, re-slices and re-renders.
 * This mirrors CatalogExplorer, including its three history-correctness
 * mechanisms (sync pushState before the transition, lastNavigatedRef, popstate
 * reset) — each one exists because a measured bug required it; see
 * CatalogExplorer.tsx for the full rationale comments.
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

/**
 * The mockup's desktop card rhythm: rows alternate 2-up (span 3 + 3) and
 * 3-up (span 2 ×3) on a 6-column grid; one full pass = 14 cards =
 * ARTICLES_PAGE_SIZE, so every full page ends on a completed row.
 */
const SPANS = [3, 3, 2, 2, 2, 3, 3, 2, 2, 2, 3, 3, 3, 3] as const;

function isPlainLeftClick(e: React.MouseEvent): boolean {
  return !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);
}

export function ArticlesExplorer({
  uiState,
  chips,
  featured,
  items,
  totalPages,
}: ArticlesExplorerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  /* While a transition is pending the props describe the PREVIOUS URL — every
     mutation must read currentState(), never the prop (CatalogExplorer
     review finding 2). */
  const lastNavigatedRef = useRef<{ state: ArticlesUiState; href: string } | null>(
    null,
  );

  useEffect(() => {
    if (
      lastNavigatedRef.current &&
      articlesHref(uiState) === lastNavigatedRef.current.href
    ) {
      lastNavigatedRef.current = null;
    }
  }, [uiState]);

  useEffect(() => {
    const onPop = () => {
      lastNavigatedRef.current = null;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const currentState = useCallback(
    () => lastNavigatedRef.current?.state ?? uiState,
    [uiState],
  );

  const scrollToGrid = useCallback(() => {
    const el = document.getElementById("articles-results");
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, []);

  const navigate = useCallback(
    (state: ArticlesUiState, opts?: { toResults?: boolean }) => {
      const href = articlesHref(state);
      // Same-URL navigation is a no-op — an identical history entry would make
      // the next Back press appear dead.
      if (href === window.location.pathname + window.location.search) {
        if (opts?.toResults) scrollToGrid();
        return;
      }
      lastNavigatedRef.current = { state, href };
      /* History entry SYNCHRONOUSLY, before the transition — router.push
         inside startTransition defers its pushState until the RSC render
         commits, leaving a window where Back leaves the site (measured on the
         catalog; same fix). */
      window.history.pushState(null, "", href);
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
      if (opts?.toResults) scrollToGrid();
    },
    [router, scrollToGrid],
  );

  const pickCategory = useCallback(
    (slug: string) => navigate({ category: slug, page: 1 }),
    [navigate],
  );

  const activeCategory = uiState.category;
  const activeChip = chips.find((c) => c.slug === activeCategory);

  return (
    <div>
      {/* Category chips — crawlable links; plain left-clicks become in-page
          transitions. */}
      <div
        role="group"
        aria-label="Фильтр по категориям"
        className="mt-8 flex flex-wrap gap-2"
      >
        {chips.map((chip) => {
          const active = chip.slug === activeCategory;
          return (
            <Link
              key={chip.slug || "all"}
              href={articlesHref({ category: chip.slug, page: 1 })}
              aria-current={active ? "true" : undefined}
              onClick={(e) => {
                if (!isPlainLeftClick(e)) return;
                e.preventDefault();
                pickCategory(chip.slug);
              }}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-full border px-[18px] text-small font-medium transition-colors duration-[150ms] focus-ring-brand",
                active
                  ? "border-surface-dark bg-surface-dark text-white"
                  : "border-border bg-surface-raised text-fg-secondary hover:border-gray-400",
              )}
            >
              {chip.label}
              <span
                aria-hidden="true"
                className={cn(
                  "text-caption font-normal",
                  active ? "text-white/65" : "text-fg-muted",
                )}
              >
                {chip.count}
              </span>
            </Link>
          );
        })}
      </div>

      <section
        id="articles-results"
        aria-busy={isPending}
        className="scroll-mt-[76px]"
      >
        {featured && !isPending && <ArticleFeaturedCard article={featured} />}

        {isPending ? (
          <ArticlesSkeletonGrid />
        ) : items.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-6">
            {items.map((article, i) => {
              const span = SPANS[i % SPANS.length];
              return (
                <ArticleCard
                  key={article.slug}
                  article={article}
                  size={span === 3 ? "lg" : "md"}
                  className={span === 3 ? "lg:col-span-3" : "lg:col-span-2"}
                />
              );
            })}
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center gap-2 rounded-[20px] border border-border bg-surface-raised px-6 py-12 text-center md:py-20">
            <div className="mb-2.5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gray-100">
              <Icon
                icon={Icons.SearchEmpty}
                size={28}
                className="text-gray-400"
              />
            </div>
            <h2 className="text-h3 font-bold tracking-[-0.01em] text-fg">
              {activeChip && activeCategory
                ? `В категории «${activeChip.label}» пока нет статей`
                : "Пока нет статей"}
            </h2>
            <p className="max-w-[400px] text-[15px] leading-[1.6] text-fg-muted">
              {activeCategory
                ? "Мы готовим материалы по этой теме. А пока посмотрите все статьи блога."
                : "Мы готовим полезные материалы о недвижимости — загляните чуть позже."}
            </p>
            {activeCategory && (
              <button
                type="button"
                onClick={() => pickCategory("")}
                className="mt-[18px] rounded-lg bg-brand px-[22px] py-[13px] text-[14.5px] font-semibold text-white transition-colors duration-[150ms] hover:bg-brand-hover focus-ring-brand"
              >
                Показать все статьи
              </button>
            )}
          </div>
        )}

        <CatalogPagination
          currentPage={uiState.page}
          totalPages={isPending ? 0 : totalPages}
          hrefForPage={(page) => articlesHref({ ...currentState(), page })}
          onNavigate={(page, e) => {
            if (!isPlainLeftClick(e)) return;
            e.preventDefault();
            navigate({ ...currentState(), page }, { toResults: true });
          }}
        />
      </section>
    </div>
  );
}

/** Card-shaped shimmer placeholders shown while a navigation is pending. */
function ArticlesSkeletonGrid() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-6">
      {SPANS.slice(0, 8).map((span, i) => (
        <div
          key={i}
          className={cn(
            "flex flex-col gap-3.5 rounded-2xl border border-border bg-surface-raised p-6",
            span === 3 ? "lg:col-span-3" : "lg:col-span-2",
          )}
        >
          <div className="ctr-skel h-3 w-24 rounded" />
          <div className="ctr-skel h-6 w-4/5 rounded" />
          <div className="ctr-skel h-4 w-full rounded" />
          <div className="ctr-skel h-4 w-2/3 rounded" />
          <div className="mt-auto flex items-center justify-between pt-1.5">
            <div className="ctr-skel h-3.5 w-20 rounded" />
            <div className="ctr-skel h-3.5 w-14 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
