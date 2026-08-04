"use client";

import Link from "next/link";
import { Icon, Icons } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface CatalogPaginationProps {
  currentPage: number;
  totalPages: number;
  /** Real href for a page — pagination is crawlable and survives reload. */
  hrefForPage: (page: number) => string;
  /**
   * Same-tab click handler: the caller preventDefaults and router.pushes
   * inside startTransition so the pending skeleton state shows. Plain hrefs
   * keep middle-click / ctrl-click / copy-link behaviour intact.
   */
  onNavigate: (page: number, e: React.MouseEvent) => void;
  className?: string;
}

/** 1 … window around current … last, per the mockup's [1 2 3 4 … 28] row. */
function pageItems(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  // Near an edge the window widens so the row always shows ≥5 numbers.
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("ellipsis");
    out.push(p);
    prev = p;
  }
  return out;
}

const CELL =
  "flex h-11 w-11 items-center justify-center rounded-xl text-[14px] focus-ring-brand";

export function CatalogPagination({
  currentPage,
  totalPages,
  hrefForPage,
  onNavigate,
  className,
}: CatalogPaginationProps) {
  if (totalPages <= 1) return null;

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  const pageLink = (page: number, label: React.ReactNode, aria?: string) => (
    <Link
      href={hrefForPage(page)}
      aria-label={aria}
      onClick={(e) => onNavigate(page, e)}
      className={cn(
        CELL,
        "border border-border bg-surface-raised font-medium text-fg-secondary transition-colors hover:border-border-strong",
      )}
    >
      {label}
    </Link>
  );

  return (
    <nav
      aria-label="Пагинация"
      className={cn("mt-8 flex items-center justify-center gap-1.5", className)}
    >
      {canPrev ? (
        pageLink(
          currentPage - 1,
          <Icon icon={Icons.ChevronLeft} size={16} />,
          "Предыдущая страница",
        )
      ) : (
        <span
          aria-disabled="true"
          className={cn(CELL, "border border-border bg-surface-raised text-gray-300")}
        >
          <Icon icon={Icons.ChevronLeft} size={16} />
        </span>
      )}

      {pageItems(currentPage, totalPages).map((item, i) =>
        item === "ellipsis" ? (
          <span
            key={`e${i}`}
            aria-hidden="true"
            className="flex h-11 w-9 items-center justify-center text-gray-400"
          >
            …
          </span>
        ) : item === currentPage ? (
          <span
            key={item}
            aria-current="page"
            className={cn(CELL, "bg-brand font-semibold text-white")}
          >
            {item}
          </span>
        ) : (
          <Link
            key={item}
            href={hrefForPage(item)}
            onClick={(e) => onNavigate(item, e)}
            className={cn(
              CELL,
              "border border-border bg-surface-raised font-medium text-fg-secondary transition-colors hover:border-border-strong",
              // The mockup hides deep-window numbers on the narrowest screens.
              i > 3 && item !== totalPages && "hidden sm:flex",
            )}
          >
            {item}
          </Link>
        ),
      )}

      {canNext ? (
        pageLink(
          currentPage + 1,
          <Icon icon={Icons.ChevronRight} size={16} />,
          "Следующая страница",
        )
      ) : (
        <span
          aria-disabled="true"
          className={cn(CELL, "border border-border bg-surface-raised text-gray-300")}
        >
          <Icon icon={Icons.ChevronRight} size={16} />
        </span>
      )}
    </nav>
  );
}
