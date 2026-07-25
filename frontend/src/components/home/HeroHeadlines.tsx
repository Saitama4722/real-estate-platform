"use client";

import type { HomepageTextMap } from "@/lib/homepageTextBlocks";
import { HomepageInlineText } from "@/components/home/HomepageInlineText";

interface HeroHeadlinesProps {
  text: Pick<HomepageTextMap, "hero_title" | "hero_subtitle">;
}

export function HeroHeadlines({ text }: HeroHeadlinesProps) {
  return (
    /*
     * Type comes from the scale tokens rather than raw `text-3xl`/`text-5xl`:
     *   mobile  — the base `h1` rule in globals.css (30/38, 700)
     *   md+     — `text-display` (44/52, 700, -0.015em), the hero's own step
     * `text-display` carries line-height, weight AND letter-spacing with it, so
     * `font-bold`/`leading-tight` are not needed and would only fight the token.
     *
     * `text-balance` on the headline keeps the two lines evenly weighted instead
     * of leaving one orphaned word on line two.
     */
    <div className="max-w-3xl">
      <HomepageInlineText
        blockKey="hero_title"
        value={text.hero_title}
        as="h1"
        className="text-balance text-white md:text-display"
      />
      <HomepageInlineText
        blockKey="hero_subtitle"
        value={text.hero_subtitle}
        as="p"
        /* 15/22 mobile → body-lg (18/28) desktop, per the two kits. Colour is
           the design's --text-inverse-dim, rgba(255,255,255,0.72). */
        className="mt-2.5 max-w-2xl text-[15px] leading-[22px] text-white/72 md:mt-3.5 md:text-body-lg"
      />
    </div>
  );
}
