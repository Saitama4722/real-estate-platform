"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CatalogPagination } from "@/components/catalog/CatalogPagination";

interface RealtorObjectsPaginationProps {
  crmId: string;
  currentPage: number;
  totalPages: number;
}

/**
 * Pagination for «Объекты риэлтора». Same URL-as-source-of-truth shape as the
 * catalog: ?page=N is read by the Server Component (shareable, crawlable —
 * the cells are real <Link>s — and back/forward just work), while a same-tab
 * click swaps only the RSC content with no document reload.
 *
 * The history entry is created SYNCHRONOUSLY with native pushState before the
 * transition, then router.replace renders onto it — router.push inside a
 * transition defers its pushState until commit, and a Back press in that
 * pending window pops PAST the page entirely (the catalog's measured
 * about:blank bug; see CLAUDE.md). Scroll is anchored to the top of the grid,
 * not the document: the user is at the bottom of the grid when they click.
 */
export function RealtorObjectsPagination({
  crmId,
  currentPage,
  totalPages,
}: RealtorObjectsPaginationProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const hrefForPage = useCallback(
    (page: number) =>
      page > 1
        ? `/realtors/${encodeURIComponent(crmId)}?page=${page}`
        : `/realtors/${encodeURIComponent(crmId)}`,
    [crmId],
  );

  const onNavigate = useCallback(
    (page: number, e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return; // new-tab / download intents keep native link behaviour
      }
      e.preventDefault();
      const href = hrefForPage(page);
      window.history.pushState(null, "", href);
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
      const grid = document.getElementById("objects");
      if (grid) {
        const reduce = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        grid.scrollIntoView({
          behavior: reduce ? "auto" : "smooth",
          block: "start",
        });
      }
    },
    [hrefForPage, router],
  );

  // CatalogPagination renders nothing at totalPages <= 1, which is exactly
  // the "hidden entirely at 12 or fewer listings" rule.
  return (
    <CatalogPagination
      currentPage={currentPage}
      totalPages={totalPages}
      hrefForPage={hrefForPage}
      onNavigate={onNavigate}
    />
  );
}
