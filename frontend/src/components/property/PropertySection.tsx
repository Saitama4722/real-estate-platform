import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * White rounded card that every content section on the property page sits in.
 *
 * One component rather than the same three Tailwind classes copy-pasted into
 * four files: the sections are visually a set, and a set that drifts is exactly
 * how this codebase ended up with two different article cards.
 */
export function PropertySection({
  title,
  badge,
  aside,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  /** Sits immediately after the title (e.g. the price-range pill). */
  badge?: ReactNode;
  /** Rendered on the title row, pushed to the right (a control or a label). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl bg-surface-raised px-[18px] py-[18px] shadow-sm md:px-6 md:py-6",
        className,
      )}
    >
      {(title || aside || badge) && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {title && (
            <h2 className="text-[17px] font-bold tracking-tight text-fg md:text-[19px]">
              {title}
            </h2>
          )}
          {badge}
          {aside && <div className="ml-auto flex items-center gap-3">{aside}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
