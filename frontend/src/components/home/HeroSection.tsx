import { Container } from "@/components/layout/container";
import { SearchBar } from "@/components/home/SearchBar";

interface HeroSectionProps {
  title: string;
  subtitle: string;
}

export function HeroSection({ title, subtitle }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-black/25" />

      <Container className="relative py-14 text-white md:py-20">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold leading-tight text-white md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-slate-100 md:mt-4 md:text-lg">
            {subtitle}
          </p>
        </div>
        <div className="mt-8 md:mt-10">
          <SearchBar variant="hero" />
        </div>
      </Container>
    </section>
  );
}
