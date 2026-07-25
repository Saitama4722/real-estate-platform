import Link from "next/link";
import { Icon, Icons } from "@/components/ui/icon";

interface SectionHeaderProps {
  /** The section's <h2>, normally a <HomepageInlineText as="h2">. */
  children: React.ReactNode;
  /** Optional right-hand "more" link. Both props required together. */
  moreHref?: string;
  moreLabel?: string;
}

/**
 * The design's `.sech` row: heading on the left, an optional "more" link
 * baseline-aligned on the right (`align-items: flex-end`).
 *
 * Not every section has a link — Категории and the О регионе block have none in
 * the kit, so the link is opt-in rather than a required prop.
 */
export function SectionHeader({
  children,
  moreHref,
  moreLabel,
}: SectionHeaderProps) {
  return (
    <div className="ctr-sech">
      {children}
      {moreHref && moreLabel ? (
        <Link
          href={moreHref}
          className="inline-flex shrink-0 items-center gap-1 text-[14px] leading-5 font-medium text-brand transition-colors duration-150 ease-out hover:text-brand-hover md:gap-1.5 md:text-[15px]"
        >
          {moreLabel}
          <Icon icon={Icons.ChevronRight} size={16} className="shrink-0" />
        </Link>
      ) : null}
    </div>
  );
}
