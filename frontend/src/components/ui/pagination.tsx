"use client";

import { cn } from "@/lib/utils";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <nav
      className={cn("flex items-center gap-1", className)}
      aria-label="Пагинация"
    >
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!canPrev}
        aria-label="Предыдущая страница"
        className={cn(
          "px-3 py-1.5 rounded-md text-sm border border-gray-300",
          canPrev
            ? "text-gray-700 hover:bg-gray-50"
            : "opacity-40 cursor-not-allowed text-gray-400",
        )}
      >
        ←
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onPageChange(page)}
          aria-current={page === currentPage ? "page" : undefined}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm border",
            page === currentPage
              ? "bg-blue-600 text-white border-blue-600"
              : "border-gray-300 text-gray-700 hover:bg-gray-50",
          )}
        >
          {page}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!canNext}
        aria-label="Следующая страница"
        className={cn(
          "px-3 py-1.5 rounded-md text-sm border border-gray-300",
          canNext
            ? "text-gray-700 hover:bg-gray-50"
            : "opacity-40 cursor-not-allowed text-gray-400",
        )}
      >
        →
      </button>
    </nav>
  );
}
