import { Container } from "@/components/layout/container";
import { HeroHeadlines } from "@/components/home/HeroHeadlines";
import { SearchBar } from "@/components/home/SearchBar";
import type { HomepageTextMap } from "@/lib/homepageTextBlocks";

interface HeroSectionProps {
  homepageText: Pick<HomepageTextMap, "hero_title" | "hero_subtitle">;
}

export function HeroSection({ homepageText }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-black/25" />

      <Container className="relative py-14 text-white md:py-20">
        <HeroHeadlines text={homepageText} />
        <div className="mt-8 md:mt-10">
          <SearchBar variant="hero" />
        </div>
      </Container>
    </section>
  );
}
