"use client";

import type { HomepageTextMap } from "@/lib/homepageTextBlocks";
import { HomepageInlineText } from "@/components/home/HomepageInlineText";

interface HeroHeadlinesProps {
  text: Pick<HomepageTextMap, "hero_title" | "hero_subtitle">;
}

export function HeroHeadlines({ text }: HeroHeadlinesProps) {
  return (
    <div className="max-w-3xl">
      <HomepageInlineText
        blockKey="hero_title"
        value={text.hero_title}
        as="h1"
        className="text-3xl font-bold leading-tight text-white md:text-5xl"
      />
      <HomepageInlineText
        blockKey="hero_subtitle"
        value={text.hero_subtitle}
        as="p"
        className="mt-3 text-sm text-slate-100 md:mt-4 md:text-lg"
      />
    </div>
  );
}
