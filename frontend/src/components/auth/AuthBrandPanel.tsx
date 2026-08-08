/**
 * The navy brand panel of the auth split-screen (server component).
 *
 * Treatment is the realtor hero's, ported: navy gradient + radial glows +
 * feTurbulence grain + slow line-art drift. All motion is CSS transforms on
 * inline SVG — no JS loop, no canvas, no WebGL — and every drift is a
 * 0→peak→0 round trip so the global reduced-motion `animation: none` leaves
 * each shape exactly at rest. Geometry and durations live in globals.css
 * (`.ctr-auth-*`), which also drops the shapes and grain at ≤1024 where the
 * panel becomes a header band.
 */

const SHAPE_STROKE = {
  fill: "none",
  strokeWidth: 2,
} as const;

export function AuthBrandPanel() {
  return (
    /* 55% is the mockup's 792/1440 split expressed proportionally — a fixed
       792px forced a 1440px-wide document at every desktop width, so anything
       from 1025 to 1439 scrolled horizontally [measured]. */
    <div className="ctr-auth-panel relative isolate flex shrink-0 flex-col overflow-hidden max-[1024px]:h-24 max-[1024px]:w-full min-[1025px]:h-auto min-[1025px]:w-[55%] md:max-[1024px]:h-[116px] min-[1025px]:min-h-screen">
      <div aria-hidden="true" className="ctr-auth-glow ctr-auth-glow--brand" />
      <div aria-hidden="true" className="ctr-auth-glow ctr-auth-glow--accent" />

      {/* Line-art field. aria-hidden: decoration only. */}
      <svg
        aria-hidden="true"
        width="440"
        height="360"
        viewBox="0 0 440 360"
        className="ctr-auth-shape ctr-auth-shape--house"
        {...SHAPE_STROKE}
      >
        <path
          d="M20 168 220 24l200 144v168a12 12 0 0 1-12 12H32a12 12 0 0 1-12-12V168Z"
          stroke="#FFFFFF"
          strokeWidth="2"
        />
        <path d="M150 340V214h140v126" stroke="#FFFFFF" strokeWidth="2" />
        <path d="M150 250h140M220 214v126" stroke="#FFFFFF" strokeWidth="2" />
      </svg>

      <svg
        aria-hidden="true"
        width="300"
        height="300"
        viewBox="0 0 300 300"
        className="ctr-auth-shape ctr-auth-shape--squares"
        {...SHAPE_STROKE}
      >
        <rect x="2" y="2" width="296" height="296" rx="44" stroke="#93B4FF" strokeWidth="2" />
        <rect x="52" y="52" width="196" height="196" rx="26" stroke="#93B4FF" strokeWidth="2" />
      </svg>

      <svg
        aria-hidden="true"
        width="180"
        height="200"
        viewBox="0 0 180 200"
        className="ctr-auth-shape ctr-auth-shape--window"
        {...SHAPE_STROKE}
      >
        <rect x="1" y="1" width="178" height="198" rx="14" stroke="#FFFFFF" strokeWidth="2" />
        <path d="M90 1v198M1 100h178" stroke="#FFFFFF" strokeWidth="2" />
      </svg>

      <svg
        aria-hidden="true"
        width="56"
        height="70"
        viewBox="0 0 24 30"
        fill="none"
        stroke="#7FA6FF"
        strokeWidth="1.5"
        className="ctr-auth-shape ctr-auth-shape--pin-lg"
      >
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>

      <svg
        aria-hidden="true"
        width="40"
        height="50"
        viewBox="0 0 24 30"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        className="ctr-auth-shape ctr-auth-shape--pin-sm"
      >
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>

      <svg
        aria-hidden="true"
        width="220"
        height="120"
        viewBox="0 0 220 120"
        className="ctr-auth-shape ctr-auth-shape--rect"
        {...SHAPE_STROKE}
      >
        <rect x="1" y="1" width="218" height="118" rx="26" stroke="#FFFFFF" strokeWidth="2" />
      </svg>

      {/* Grain. ⚠ The filter id is document-global — `ctr-auth-grain` must stay
          distinct from the realtor page's `ctr-rp-grain`. */}
      <svg
        aria-hidden="true"
        preserveAspectRatio="none"
        className="ctr-auth-grain pointer-events-none absolute inset-0 h-full w-full opacity-50 mix-blend-overlay"
      >
        <filter id="ctr-auth-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#ctr-auth-grain)" opacity="0.34" />
      </svg>

      {/* Content. On the ≤1024 band this collapses to logo + subline on one row. */}
      <div className="relative z-[1] flex h-full flex-col justify-between px-5 max-[1024px]:flex-row max-[1024px]:items-center min-[1025px]:px-20 min-[1025px]:py-14 md:max-[1024px]:px-8">
        <div className="flex items-center gap-3 max-[1024px]:gap-2.5">
          <svg
            aria-hidden="true"
            viewBox="0 0 36 36"
            fill="none"
            className="h-7 w-7 shrink-0 md:h-8 md:w-8 min-[1025px]:h-9 min-[1025px]:w-9"
          >
            <rect width="36" height="36" rx="10" className="fill-brand" />
            <path
              d="M9 17.5 18 10l9 7.5"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 18v8h12v-8"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 26v-4h4v4"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div>
            <div className="text-[17px] leading-none font-bold tracking-[-0.02em] text-white md:text-[18px] min-[1025px]:text-[22px]">
              Centreal
            </div>
            {/* Band-only subline; the desktop panel has the full headline below. */}
            <div className="mt-0.5 text-[12px] leading-[1.3] text-blue-200 md:text-[13px] min-[1025px]:hidden">
              Кабинет сотрудника
            </div>
          </div>
        </div>

        <div className="max-w-[520px] max-[1024px]:hidden">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 px-3.5 py-[7px]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-green-400" />
            <span className="text-caption font-semibold tracking-[0.08em] uppercase text-blue-100">
              Внутренняя система
            </span>
          </div>
          <h2 className="m-0 text-[clamp(38px,4vw,56px)] leading-[1.06] font-bold tracking-[-0.03em] text-white">
            Кабинет сотрудника
          </h2>
          <p className="mt-[18px] max-w-[460px] text-[19px] leading-[1.55] text-pretty text-blue-200">
            Объекты, заявки и клиенты Краснодара и Геленджика — в одном рабочем
            пространстве.
          </p>
        </div>

        <div className="flex items-center gap-2.5 max-md:hidden">
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-blue-300"
          >
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="text-small font-medium text-blue-200">
            Краснодар · Геленджик
          </span>
        </div>
      </div>
    </div>
  );
}
