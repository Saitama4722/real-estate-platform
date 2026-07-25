"use client";

import Link from "next/link";
import { useCompare } from "@/lib/compare";

/**
 * Floating comparison bar, fixed to the bottom. Appears only when 2+ properties
 * are selected (comparing a single item is meaningless). Lets the user jump to
 * /compare or clear the whole selection. Renders nothing until the store
 * hydrates (avoids an SSR flash).
 */
export function CompareBar() {
  const { count, ready, clearCompare } = useCompare();

  if (!ready || count < 2) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[1000] flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-gray-200 bg-white/95 py-2 pl-5 pr-2 shadow-lg shadow-black/10 backdrop-blur-sm">
        <span className="text-sm font-medium text-gray-900">
          Выбрано для сравнения: {count}
        </span>
        <button
          type="button"
          onClick={clearCompare}
          className="text-sm text-gray-500 transition-colors hover:text-gray-800"
        >
          Очистить
        </button>
        <Link
          href="/compare"
          className="inline-flex h-9 items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
        >
          Сравнить ({count})
        </Link>
      </div>
    </div>
  );
}
