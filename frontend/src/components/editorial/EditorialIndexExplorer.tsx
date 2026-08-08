"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useTransition } from "react";
import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import { ArticleCard, type ArticleCardData } from "@/components/articles/ArticleCard";
import { ArticleFeaturedCard } from "@/components/articles/ArticleFeaturedCard";
import { Icon, Icons } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * The editorial index — hero-less body of /articles AND /districts: filter
 * chips with live counts, an optional featured lead, the varied-rhythm card
 * grid, URL-driven pagination and the empty state.
 *
 * Generic over the page's own state type `S`, which stays OPAQUE here: each
 * route supplies `hrefOf`, its facets' `valueOf`/`apply`, and `withPage`. That
 * is why this component is only ever rendered by a thin per-route CLIENT
 * wrapper — functions cannot cross the RSC boundary (CLAUDE.md, load-bearing
 * lesson #3), so a Server Component may not pass them in directly.
 *
 * Navigation copies the catalog idiom exactly, including all three
 * correctness mechanisms — see CatalogExplorer.tsx for the measured bugs each
 * one fixes.
 */

export interface EditorialChip {
  /** "" is the «Все» chip. */
  value: string;
  label: string;
  count: number;
}

export interface EditorialFacet<S> {
  key: string;
  /** Row label; omit for a single-facet page that needs no labelling. */
  label?: string;
  ariaLabel: string;
  chips: EditorialChip[];
  valueOf: (state: S) => string;
  /** Must also reset the page — a narrowed result set invalidates it. */
  apply: (state: S, value: string) => S;
}

interface EditorialIndexExplorerProps<S> {
  state: S;
  hrefOf: (state: S) => string;
  facets: EditorialFacet<S>[];
  /** 0, 1 or 2 lead cards; 2 render side by side. */
  featured?: ArticleCardData[];
  items: ArticleCardData[];
  page: number;
  totalPages: number;
  withPage: (state: S, page: number) => S;
  empty: {
    title: string;
    body: string;
    /** Omit to hide the reset button (nothing to reset). */
    resetLabel?: string;
    resetTo?: (state: S) => S;
  };
  /** Anchor id for scroll-to-results; unique per route. */
  resultsId: string;
}

/**
 * The mockup's desktop rhythm: rows alternate 2-up (span 3+3) and 3-up
 * (span 2×3) on a 6-column grid. One full pass is 14 cards — the page size —
 * so a full page always ends on a completed row.
 */
const SPANS = [3, 3, 2, 2, 2, 3, 3, 2, 2, 2, 3, 3, 3, 3] as const;

function isPlainLeftClick(e: React.MouseEvent): boolean {
  return !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);
}

export function EditorialIndexExplorer<S>({
  state,
  hrefOf,
  facets,
  featured = [],
  items,
  page,
  totalPages,
  withPage,
  empty,
  resultsId,
}: EditorialIndexExplorerProps<S>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  /* While a transition is pending the `state` PROP still describes the
     previous URL, so every mutation must read currentState() — two chip taps
     inside one pending window would otherwise lose the first. */
  const lastNavigatedRef = useRef<{ state: S; href: string } | null>(null);

  useEffect(() => {
    if (lastNavigatedRef.current && hrefOf(state) === lastNavigatedRef.current.href) {
      lastNavigatedRef.current = null;
    }
  }, [state, hrefOf]);

  useEffect(() => {
    const onPop = () => {
      lastNavigatedRef.current = null;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const currentState = useCallback(
    () => lastNavigatedRef.current?.state ?? state,
    [state],
  );

  const scrollToResults = useCallback(() => {
    const el = document.getElementById(resultsId);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [resultsId]);

  const navigate = useCallback(
    (next: S, opts?: { toResults?: boolean }) => {
      const href = hrefOf(next);
      // Same-URL navigation is a no-op: an identical history entry would make
      // the next Back press appear dead.
      if (href === window.location.pathname + window.location.search) {
        if (opts?.toResults) scrollToResults();
        return;
      }
      lastNavigatedRef.current = { state: next, href };
      /* History entry SYNCHRONOUSLY, before the transition: router.push inside
         startTransition defers its pushState until the RSC render commits,
         leaving a window in which Back leaves the site entirely. */
      window.history.pushState(null, "", href);
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
      if (opts?.toResults) scrollToResults();
    },
    [router, scrollToResults, hrefOf],
  );

  const multiFacet = facets.length > 1;

  return (
    <div>
      <div className={cn("mt-8 flex flex-col", multiFacet ? "gap-3" : "gap-2")}>
        {facets.map((facet) => {
          const active = facet.valueOf(state);
          return (
            <div
              key={facet.key}
              className={cn(
                "flex flex-wrap items-center gap-2",
                multiFacet && "sm:flex-nowrap sm:items-start",
              )}
            >
              {facet.label && (
                <span
                  aria-hidden="true"
                  className="w-full text-caption font-bold tracking-[0.08em] uppercase text-fg-muted sm:w-[68px] sm:shrink-0 sm:pt-3.5"
                >
                  {facet.label}
                </span>
              )}
              <div
                role="group"
                aria-label={facet.ariaLabel}
                className="flex flex-wrap gap-2"
              >
                {facet.chips.map((chip) => {
                  const isActive = chip.value === active;
                  return (
                    <Link
                      key={chip.value || "all"}
                      href={hrefOf(facet.apply(state, chip.value))}
                      aria-current={isActive ? "true" : undefined}
                      onClick={(e) => {
                        if (!isPlainLeftClick(e)) return;
                        e.preventDefault();
                        navigate(facet.apply(currentState(), chip.value));
                      }}
                      className={cn(
                        "inline-flex h-11 items-center gap-2 rounded-full border px-[18px] text-small font-medium transition-colors duration-[150ms] focus-ring-brand",
                        isActive
                          ? "border-surface-dark bg-surface-dark text-white"
                          : "border-border bg-surface-raised text-fg-secondary hover:border-gray-400",
                      )}
                    >
                      {chip.label}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "text-caption font-normal",
                          isActive ? "text-white/65" : "text-fg-muted",
                        )}
                      >
                        {chip.count}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <section id={resultsId} aria-busy={isPending} className="scroll-mt-[76px]">
        {!isPending && featured.length > 0 && (
          <div
            className={cn(
              featured.length > 1 && "grid grid-cols-1 gap-5 md:grid-cols-2",
            )}
          >
            {featured.map((item) => (
              <ArticleFeaturedCard
                key={item.slug}
                article={item}
                size={featured.length > 1 ? "half" : "full"}
              />
            ))}
          </div>
        )}

        {isPending ? (
          <EditorialSkeletonGrid />
        ) : items.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-6">
            {items.map((item, i) => {
              const span = SPANS[i % SPANS.length];
              return (
                <ArticleCard
                  key={item.slug}
                  article={item}
                  size={span === 3 ? "lg" : "md"}
                  className={span === 3 ? "lg:col-span-3" : "lg:col-span-2"}
                />
              );
            })}
          </div>
        ) : featured.length === 0 ? (
          /* Suppressed when a lead card is showing: the page is not empty. */
          <div className="mt-8 flex flex-col items-center gap-2 rounded-[20px] border border-border bg-surface-raised px-6 py-12 text-center md:py-20">
            <div className="mb-2.5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gray-100">
              <Icon icon={Icons.SearchEmpty} size={28} className="text-gray-400" />
            </div>
            <h2 className="text-h3 font-bold tracking-[-0.01em] text-fg">
              {empty.title}
            </h2>
            <p className="max-w-[400px] text-[15px] leading-[1.6] text-fg-muted">
              {empty.body}
            </p>
            {empty.resetLabel && empty.resetTo && (
              <button
                type="button"
                onClick={() => navigate(empty.resetTo!(currentState()))}
                className="mt-[18px] rounded-lg bg-brand px-[22px] py-[13px] text-[14.5px] font-semibold text-white transition-colors duration-[150ms] hover:bg-brand-hover focus-ring-brand"
              >
                {empty.resetLabel}
              </button>
            )}
          </div>
        ) : null}

        <CatalogPagination
          currentPage={page}
          totalPages={isPending ? 0 : totalPages}
          hrefForPage={(p) => hrefOf(withPage(currentState(), p))}
          onNavigate={(p, e) => {
            if (!isPlainLeftClick(e)) return;
            e.preventDefault();
            navigate(withPage(currentState(), p), { toResults: true });
          }}
        />
      </section>
    </div>
  );
}

function EditorialSkeletonGrid() {
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
