import type { LucideIcon } from "lucide-react";
import { Container } from "@/components/layout/container";
import { HeroHeadlines } from "@/components/home/HeroHeadlines";
import { HomeHeroSearch } from "@/components/home/HomeHeroSearch";
import { Icons } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { HomepageTextMap } from "@/lib/homepageTextBlocks";
import type { CatalogLocationData } from "@/lib/publicLocations";

interface HeroSectionProps {
  homepageText: Pick<HomepageTextMap, "hero_title" | "hero_subtitle">;
  /** Server-fetched location dictionaries for the search panel. */
  locationData: CatalogLocationData;
}

type Depth = "back" | "mid" | "front";

interface HeroFieldIcon {
  icon: LucideIcon;
  depth: Depth;
  /** Percentage offsets, so the field reflows with the viewport. */
  left: string;
  top: string;
  /** Rendered box in px — the depth ladder is 130–170 / 70–85 / 30–40. */
  size: number;
  /** Negative delay, so each icon starts mid-drift instead of all together. */
  delay: number;
  /** Puts this icon on the alternate drift path/duration. */
  alt?: boolean;
  /** One of the 7 icons kept in the reduced mobile field. */
  mobile?: boolean;
}

/**
 * The drifting icon field, from the design system's hero spec
 * (design-audit/design-system/guidelines/motion-hero.html): three depth layers,
 * 16 icons on desktop and 7 on mobile.
 *
 * ⚠ Every icon sits to the RIGHT of ~38% because the field's mask cuts a hole
 * over the headline zone on the left. An icon placed further left is masked
 * away and looks like it simply failed to render.
 */
const HERO_FIELD: HeroFieldIcon[] = [
  // back — 130–170px, 5% opacity, slightly blurred
  { icon: Icons.Apartment, depth: "back", left: "58%", top: "-6%", size: 168, delay: -3, mobile: true },
  { icon: Icons.House, depth: "back", left: "86%", top: "46%", size: 148, delay: -10, alt: true },
  { icon: Icons.Commercial, depth: "back", left: "70%", top: "74%", size: 132, delay: 0 },
  { icon: Icons.Land, depth: "back", left: "43%", top: "58%", size: 138, delay: -11, alt: true },
  // mid — 70–85px, 8%
  { icon: Icons.Floor, depth: "mid", left: "52%", top: "22%", size: 84, delay: -7 },
  { icon: Icons.Key, depth: "mid", left: "76%", top: "10%", size: 72, delay: -11, alt: true, mobile: true },
  { icon: Icons.Address, depth: "mid", left: "92%", top: "24%", size: 76, delay: -10 },
  { icon: Icons.House, depth: "mid", left: "64%", top: "48%", size: 80, delay: -8, alt: true, mobile: true },
  { icon: Icons.Trees, depth: "mid", left: "95%", top: "68%", size: 70, delay: -4 },
  { icon: Icons.Apartment, depth: "mid", left: "38%", top: "82%", size: 74, delay: -13, alt: true },
  // front — 30–40px, 12%
  { icon: Icons.Address, depth: "front", left: "67%", top: "30%", size: 40, delay: -7, mobile: true },
  { icon: Icons.Area, depth: "front", left: "84%", top: "60%", size: 36, delay: -8, alt: true, mobile: true },
  { icon: Icons.Key, depth: "front", left: "57%", top: "68%", size: 34, delay: -1 },
  { icon: Icons.Door, depth: "front", left: "90%", top: "40%", size: 38, delay: -10, alt: true, mobile: true },
  { icon: Icons.Land, depth: "front", left: "73%", top: "18%", size: 32, delay: -10 },
  { icon: Icons.Commercial, depth: "front", left: "48%", top: "38%", size: 36, delay: -8, alt: true, mobile: true },
];

/** Painted back-to-front, so the layer order here is load-bearing. */
const DEPTH_ORDER: Depth[] = ["back", "mid", "front"];

function HeroField() {
  return (
    <div className="ctr-hero__field" aria-hidden="true">
      {DEPTH_ORDER.map((depth) => (
        <div key={depth} className="ctr-hero__layer">
          {HERO_FIELD.filter((item) => item.depth === depth).map((item, i) => {
            const Glyph = item.icon;
            return (
              <span
                key={`${depth}-${i}`}
                className={cn(
                  "ctr-hero__icon",
                  `ctr-hero__icon--${depth}`,
                  item.alt && "alt",
                  !item.mobile && "ctr-hero__icon--wide",
                )}
                style={{
                  left: item.left,
                  top: item.top,
                  width: item.size,
                  height: item.size,
                  animationDelay: `${item.delay}s`,
                }}
              >
                {/* The raw Lucide component, NOT the <Icon> wrapper: these are
                    decorative silhouettes sized to 100% by the CSS, not glyphs
                    on the 16/20/24/28 UI ladder Icon enforces. */}
                <Glyph />
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function HeroSection({ homepageText, locationData }: HeroSectionProps) {
  return (
    <>
      {/*
       * `.ctr-hero` carries the navy gradient plus the two radial highlights. It
       * deliberately has NO overflow clipping and NO isolation of its own — see
       * the note on `.ctr-hero` in globals.css for why either would re-break the
       * search panel's District combobox. The clipping that IS needed lives on the
       * decorative `.ctr-hero__field` layer, which also stops the wide
       * right-hand icons from widening the document.
       *
       * The large bottom padding is not slack: it is the navy that shows behind
       * the top half of the pulled-up search panel below.
       *
       * z-[1] lifts the copy above the field layer (z-0). Keep the BRACKET form:
       * `1` is not in Tailwind's default z-scale (0/10/20/30/40/50), and an IDE
       * "canonicalize to z-1" suggestion risks the documented silent-no-op
       * failure. Do not apply that lint fix.
       */}
      <section className="ctr-hero">
        <HeroField />
        {/* 40/120 mobile → 76/168 desktop, per the kit's `.hero` rule. The
            oversized bottom padding is the navy showing behind the pulled-up
            panel below. */}
        <Container className="relative z-[1] pt-10 pb-30 text-white md:pt-19 md:pb-42">
          <HeroHeadlines text={homepageText} />
        </Container>
      </section>

      {/*
       * Pull-up search panel — straddles the hero's bottom boundary so it reads
       * as the most contrasted element on the screen.
       *
       * A NEGATIVE MARGIN, not a transform: a translated panel would keep its
       * original layout box inside the hero and then visually hang over the
       * Категории section below it. The negative margin actually moves the box,
       * so following sections lay out around it. Living OUTSIDE the <section>
       * additionally guarantees no hero-level clip can ever reach the dropdown.
       *
       * z-[1] keeps the panel (and its dropdown) above the following sections.
       * Bracket form deliberately — see the note above.
       */}
      <div className="relative z-[1] -mt-23 md:-mt-[118px]">
        <Container>
          <HomeHeroSearch locationData={locationData} />
        </Container>
      </div>
    </>
  );
}
