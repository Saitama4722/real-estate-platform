"use client";

import { useId, useState } from "react";
import { Icon, Icons } from "@/components/ui/icon";
import type { ArticleTocEntry } from "@/lib/articleContent";
import { useTocScrollSpy } from "@/components/articles/ArticleToc";
import { cn } from "@/lib/utils";

/**
 * Tablet TOC (the mockup's 720–1139px band; here md → <1140 — the visibility
 * classes live on the page wrapper): a collapsible card above the body.
 * Below md there is no TOC at all, per the mockup. Shares the scroll-spy and
 * scroll-to logic with the desktop rail via useTocScrollSpy.
 */

interface ArticleTocAccordionProps {
  entries: ArticleTocEntry[];
}

export function ArticleTocAccordion({ entries }: ArticleTocAccordionProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { scrollToEntry } = useTocScrollSpy(entries);
  if (entries.length < 2) return null;

  return (
    <div className="mt-7 overflow-hidden rounded-xl border border-border bg-surface-raised">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-[18px] py-3.5 text-left text-[15px] font-semibold text-fg focus-ring-brand"
      >
        Содержание
        <Icon
          icon={Icons.ChevronDown}
          size={16}
          className={cn(
            "shrink-0 text-fg-muted transition-transform duration-[200ms]",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div id={panelId} className="flex flex-col px-[18px] pt-0.5 pb-3.5">
          {entries.map((entry) => (
            <a
              key={entry.id}
              href={`#${entry.id}`}
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                scrollToEntry(entry.id);
              }}
              className="py-[9px] text-small leading-[1.45] text-fg-secondary transition-colors duration-[150ms] hover:text-fg focus-ring-brand"
            >
              {entry.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
