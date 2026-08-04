import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * `dark` is for breadcrumbs sitting on a navy hero rather than on the page
 * background — the default greys fail contrast there. Added as a variant rather
 * than by overriding colours through `className`, because `cn()` is a plain
 * join (NOT tailwind-merge): a `text-*` override would leave BOTH classes on the
 * element and let stylesheet order pick the winner. See the same note in
 * button-classes.ts.
 *
 * ⚠ `default` must stay exactly as it was — every other page renders it.
 *
 * `strong` darkens links/muted one step (gray-500 → gray-600): gray-500 on
 * the warm page background measures 4.49:1 `[measured]` — a hair under
 * WCAG AA — so pages audited to AA (the catalog) opt into this tone. The
 * separator stays gray-300: it is aria-hidden decoration, exempt from AA.
 */
export type BreadcrumbsTone = "default" | "strong" | "dark";

const TONES: Record<
  BreadcrumbsTone,
  { nav: string; sep: string; current: string; muted: string; link: string }
> = {
  default: {
    nav: "text-sm text-gray-500",
    sep: "text-gray-300",
    current: "text-gray-900",
    muted: "text-gray-500",
    link: "hover:text-gray-700 transition-colors",
  },
  strong: {
    nav: "text-sm text-gray-600",
    sep: "text-gray-300",
    current: "text-gray-900",
    muted: "text-gray-600",
    link: "hover:text-gray-800 transition-colors",
  },
  dark: {
    // White at 78% on the hero's darkest wash measures ~7.5:1 — clears AA for
    // body text with room to spare, and the current page (full white) is higher.
    nav: "text-sm text-white/[.78]",
    sep: "text-white/40",
    current: "font-medium text-white",
    muted: "text-white/[.78]",
    link: "transition-colors hover:text-white",
  },
};

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  tone?: BreadcrumbsTone;
}

export function Breadcrumbs({
  items,
  className,
  tone = "default",
}: BreadcrumbsProps) {
  const t = TONES[tone];
  return (
    <nav aria-label="Хлебные крошки" className={cn(t.nav, className)}>
      <ol className="flex items-center gap-1 flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && (
                <span aria-hidden="true" className={t.sep}>
                  /
                </span>
              )}
              {isLast || !item.href ? (
                <span
                  className={cn(isLast ? t.current : t.muted)}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className={t.link}>
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
