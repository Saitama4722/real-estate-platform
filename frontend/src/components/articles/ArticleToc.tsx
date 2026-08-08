"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ArticleTocEntry } from "@/lib/articleContent";
import { cn } from "@/lib/utils";

/**
 * Table of contents, generated from the article's REAL parsed headings
 * (lib/articleContent.ts) — the ids here are the ids ArticleBodyRenderer put
 * on the h2s, so the two can never drift.
 *
 * Scroll-spy is an rAF-throttled position sweep, NOT IntersectionObserver
 * (IO misses threshold-skipping viewport jumps — documented ban, see
 * RevealController): the active entry is the last heading whose top has
 * crossed the reading line under the sticky header. Click scrolls to the
 * heading minus the same offset the headings' scroll-mt uses.
 *
 * Degrades by not rendering at all for fewer than two headings — a one-entry
 * TOC navigates nowhere.
 */

/**
 * Keep in sync with scroll-mt-[76px] on the headings (ArticleBodyRenderer).
 * 76 = the COMPACT header (52px, which any programmatic scroll from the top
 * ends under) + breathing room — the catalog's scroll-mt convention. The
 * mockup's 92 assumed a fixed 64px header.
 */
const SCROLL_OFFSET = 76;
/** A heading is "reached" once its top is within this line from the top. */
const ACTIVE_LINE = SCROLL_OFFSET + 28;

export function useTocScrollSpy(entries: ArticleTocEntry[]) {
  const [activeId, setActiveId] = useState<string>(entries[0]?.id ?? "");
  const tickingRef = useRef(false);

  useEffect(() => {
    if (entries.length === 0) return;
    const measure = () => {
      tickingRef.current = false;
      let current = entries[0].id;
      for (const entry of entries) {
        const el = document.getElementById(entry.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= ACTIVE_LINE) current = entry.id;
      }
      setActiveId(current);
    };
    const onScrollOrResize = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [entries]);

  const scrollToEntry = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET,
      behavior: reduce ? "auto" : "smooth",
    });
    /* The sticky header COMPACTS (64→52px) during this very scroll, shifting
       the document 12px and stranding the pre-computed target off the anchor
       [measured]. Wait for the scroll to settle (3 stable frames), then apply
       one instant correction if the heading missed the offset line. */
    let last = -1;
    let stable = 0;
    let frames = 0;
    const settle = () => {
      frames += 1;
      const y = window.scrollY;
      stable = y === last ? stable + 1 : 0;
      last = y;
      if (stable >= 3 || frames > 150) {
        const delta = el.getBoundingClientRect().top - SCROLL_OFFSET;
        if (Math.abs(delta) > 2) window.scrollBy({ top: delta, behavior: "auto" });
        return;
      }
      requestAnimationFrame(settle);
    };
    requestAnimationFrame(settle);
  }, []);

  return { activeId, scrollToEntry };
}

interface ArticleTocProps {
  entries: ArticleTocEntry[];
}

/** Desktop sticky rail (≥1140px, the mockup's own breakpoint). */
export function ArticleToc({ entries }: ArticleTocProps) {
  const { activeId, scrollToEntry } = useTocScrollSpy(entries);
  if (entries.length < 2) return null;

  return (
    <nav aria-label="Содержание" className="sticky top-24">
      <p className="mb-3.5 text-[11.5px] font-bold tracking-[0.1em] uppercase text-fg-muted">
        Содержание
      </p>
      <div className="flex flex-col border-l border-border">
        {entries.map((entry) => {
          const active = entry.id === activeId;
          return (
            <a
              key={entry.id}
              href={`#${entry.id}`}
              aria-current={active ? "true" : undefined}
              onClick={(e) => {
                e.preventDefault();
                scrollToEntry(entry.id);
              }}
              className={cn(
                "-ml-[1.5px] border-l-2 py-[7px] pl-4 text-[13.5px] leading-[1.45] transition-colors duration-[150ms] focus-ring-brand",
                active
                  ? "border-brand font-semibold text-fg"
                  : "border-transparent text-fg-muted hover:text-fg",
              )}
            >
              {entry.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
