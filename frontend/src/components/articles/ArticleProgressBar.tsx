"use client";

import { useEffect, useRef } from "react";

/**
 * Reading-progress bar: a fixed 3px brand line under the sticky header whose
 * fill tracks scroll progress THROUGH THE ARTICLE BODY (the element with
 * id={targetId}), not the whole document — 0 until the body's top reaches the
 * viewport top, 1 when its bottom meets the viewport bottom.
 *
 * rAF-throttled passive scroll/resize listeners (never IntersectionObserver —
 * see RevealController for why IO is banned here). The bar top is re-measured
 * from the live header rect every frame, so it follows the compact-header
 * height change instead of floating 12px below it. DOM styles are written
 * imperatively inside the rAF — no React re-render per scroll frame.
 *
 * No transition on the fill: the bar mirrors scroll position exactly, so it
 * only moves when the reader scrolls — nothing autonomous to reduce for
 * prefers-reduced-motion.
 */

interface ArticleProgressBarProps {
  targetId: string;
}

export function ArticleProgressBar({ targetId }: ArticleProgressBarProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const fill = fillRef.current;
    if (!wrap || !fill) return;

    let ticking = false;
    const measure = () => {
      ticking = false;
      const target = document.getElementById(targetId);
      if (!target) return;

      const header = document.querySelector("header");
      const top = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
      wrap.style.top = `${top}px`;

      const rect = target.getBoundingClientRect();
      const total = rect.height - (window.innerHeight - top);
      let progress: number;
      if (total <= 0) {
        // Body shorter than the viewport: full as soon as it is on screen.
        progress = rect.top < window.innerHeight ? 1 : 0;
      } else {
        progress = Math.min(1, Math.max(0, (top - rect.top) / total));
      }
      fill.style.transform = `scaleX(${progress})`;
    };

    const onScrollOrResize = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [targetId]);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      /* z-[55]: above page content, below the header dropdown/mobile panel
         (z-[1000]). Bracket form — bare z-N has burned this project before. */
      className="pointer-events-none fixed inset-x-0 z-[55] h-[3px]"
      style={{ top: "var(--header-h)" }}
    >
      <div
        ref={fillRef}
        data-progress-fill=""
        className="h-full w-full origin-left bg-brand"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
