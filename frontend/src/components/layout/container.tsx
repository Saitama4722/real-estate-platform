import { cn } from "@/lib/utils";

/**
 * Max-width variants. `default` is the public-site width; `wide` (1536px) is for
 * data-dense app screens such as the realtor cabinet tables, which otherwise
 * clip their right-most columns.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY 1248px AND NOT 1200px — the design's container token is
 * `--container-max: 1200px`, applied in the kit as
 * `.wrap{max-width:1200px;padding:0 24px}`. The kit has no CSS reset, so that
 * rule resolves under the CSS default `box-sizing: content-box`: 1200px of
 * CONTENT plus 24px of padding a side = a 1248px border box. (Confirmed by
 * measuring the kit in a browser: `.ctr-footer__in` renders 1248px wide inside
 * a 1440px viewport.)
 *
 * Tailwind's preflight sets `box-sizing: border-box` globally, so `max-w-*`
 * here includes the padding. Writing `max-w-[1200px] px-6` would therefore give
 * only 1152px of content — 48px narrower than the design. 1248 is what makes
 * the CONTENT 1200px, which is the number the design actually aligns to.
 *
 * Was `max-w-6xl` (1152px total → 1120px content), i.e. 80px too narrow.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NB: Tailwind v4 `wide` uses the `--breakpoint-2xl` (96rem / 1536px) theme
 * token via arbitrary-property syntax. See the `max-w-screen-*` note in
 * CLAUDE.md — that utility does still compile, but naming the token is clearer.
 */
const CONTAINER_SIZES = {
  default: "max-w-[1248px]",
  wide: "max-w-(--breakpoint-2xl)",
} as const;

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  size?: keyof typeof CONTAINER_SIZES;
}

export function Container({
  className,
  children,
  size = "default",
  ...props
}: ContainerProps) {
  return (
    /* Gutters follow the kit: 16px on mobile (`mobile.html` .wrap), 24px from
       md up (`index.html` .wrap). Was a flat px-4 at every width. */
    <div
      className={cn("mx-auto px-4 md:px-6", CONTAINER_SIZES[size], className)}
      {...props}
    >
      {children}
    </div>
  );
}
