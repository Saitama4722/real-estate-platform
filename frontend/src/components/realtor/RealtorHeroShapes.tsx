/**
 * The hero's seven drifting geometric shapes. Pure markup — a server component,
 * so it costs no client JS. All positioning, colour, radius and drift live in
 * `.ctr-rp-shape*` in globals.css; the only thing passed inline is `--ctr-rp-d`,
 * the parallax depth, which is a plain number and not a design value.
 *
 * The whole layer is `aria-hidden` and `pointer-events-none` — it is decoration,
 * and it sits over the hero's text column at some viewport widths.
 *
 * ⚠ `overflow-hidden` belongs HERE, on the decorative wrapper, and NOT on the
 * hero <section>. Putting it on the section is what clipped the homepage hero's
 * district dropdown (see the ancestor-overflow checklist in CLAUDE.md); it would
 * also clip the stats strip, which deliberately overlaps the hero's bottom edge.
 */
const SHAPES = [
  { cls: "ctr-rp-shape--a ctr-rp-shape--wide", depth: 26 },
  { cls: "ctr-rp-shape--b ctr-rp-shape--wide", depth: 42 },
  { cls: "ctr-rp-shape--c ctr-rp-shape--wide", depth: 16 },
  { cls: "ctr-rp-shape--g ctr-rp-shape--wide", depth: 20 },
] as const;

export function RealtorHeroShapes() {
  return (
    <div
      aria-hidden="true"
      className="ctr-rp-hero__shapes pointer-events-none absolute inset-0"
    >
      {SHAPES.map((s) => (
        <div
          key={s.cls}
          className={`ctr-rp-shape ${s.cls}`}
          style={{ "--ctr-rp-d": s.depth } as React.CSSProperties}
        />
      ))}

      {/* House outline */}
      <svg
        viewBox="0 0 120 120"
        className="ctr-rp-shape ctr-rp-shape--d"
        style={{ "--ctr-rp-d": 54 } as React.CSSProperties}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 54 60 22l42 32v44a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6z" />
        <path d="M48 104V70h24v34" />
      </svg>

      {/* Map pin */}
      <svg
        viewBox="0 0 90 90"
        className="ctr-rp-shape ctr-rp-shape--e"
        style={{ "--ctr-rp-d": 34 } as React.CSSProperties}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M73 36c0 22-28 42-28 42S17 58 17 36a28 28 0 0 1 56 0z" />
        <circle cx="45" cy="35" r="10" />
      </svg>

      {/* Window grid */}
      <svg
        viewBox="0 0 80 80"
        className="ctr-rp-shape ctr-rp-shape--f"
        style={{ "--ctr-rp-d": 60 } as React.CSSProperties}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="14" y="14" width="52" height="52" rx="12" />
        <path d="M14 40h52M40 14v52" />
      </svg>
    </div>
  );
}
