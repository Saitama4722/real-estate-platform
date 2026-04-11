import { Container } from "@/components/layout/container";

interface SeoTextSectionProps {
  text: string;
}

export function SeoTextSection({ text }: SeoTextSectionProps) {
  return (
    <section className="py-10 md:py-12">
      <Container>
        <h2 className="text-2xl font-semibold text-gray-900">
          Недвижимость в Краснодарском крае
        </h2>
        <p className="mt-4 max-w-4xl text-sm text-gray-600 md:text-base">{text}</p>
      </Container>
    </section>
  );
}

