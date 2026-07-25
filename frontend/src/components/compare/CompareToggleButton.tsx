"use client";

import { useEffect, useRef, useState } from "react";
import {
  useCompare,
  type ComparePropertyType,
} from "@/lib/compare";
import { cn } from "@/lib/utils";

interface CompareToggleButtonProps {
  /** Property slug — the compare identifier. */
  compareId: string;
  /** Property type — enforces same-type-only comparison. */
  compareType: ComparePropertyType;
  className?: string;
}

/**
 * Compare toggle over a property card image, sitting beside the favorite heart.
 * Toggling is local-only and optimistic. Stops the click bubbling to the card's
 * <Link>, so it never navigates. When an add is blocked (different type or the
 * max is reached) a brief inline message appears for a couple of seconds.
 */
export function CompareToggleButton({
  compareId,
  compareType,
  className,
}: CompareToggleButtonProps) {
  const { isComparing, toggleCompare, ready } = useCompare();
  const active = isComparing(compareId);
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flash = (text: string) => {
    setMessage(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(null), 2500);
  };

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const result = toggleCompare(compareId, compareType);
    if (!result.ok && result.message) flash(result.message);
  };

  return (
    // `className` carries the absolute positioning from PropertyCard
    // (`absolute left-2 top-2 z-10`). Do NOT also add `relative` here — `cn` is a
    // plain join (no tailwind-merge), so `relative absolute` would both land in
    // the class list and `relative` (later in Tailwind's stylesheet) would win,
    // pulling the button out of the image box and overlapping the price text
    // below. An absolutely-positioned element is already a containing block for
    // its absolutely-positioned children (the flash message), so no `relative`
    // wrapper is needed.
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={ready ? active : false}
        aria-label={active ? "Убрать из сравнения" : "Добавить к сравнению"}
        title={active ? "Убрать из сравнения" : "Добавить к сравнению"}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-sm backdrop-blur-sm transition-colors",
          "hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
          active && "bg-blue-600 text-white hover:bg-blue-600",
        )}
      >
        {/* Balance-scale / compare icon; checkmark overlay when active. */}
        {active ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v18" />
            <path d="M6 8l-4 6h8L6 8z" />
            <path d="M18 8l-4 6h8l-4-6z" />
            <path d="M4 20h16" />
          </svg>
        )}
      </button>

      {message && (
        <div
          role="status"
          className="absolute right-0 top-full z-20 mt-1 w-max max-w-[12rem] rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-lg"
        >
          {message}
        </div>
      )}
    </div>
  );
}
