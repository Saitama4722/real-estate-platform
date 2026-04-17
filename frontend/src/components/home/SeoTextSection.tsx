import { Container } from "@/components/layout/container";
import { HomepageInlineText } from "@/components/home/HomepageInlineText";

interface SeoTextSectionProps {
  title: string;
  body: string;
}

export function SeoTextSection({ title, body }: SeoTextSectionProps) {
  return (
    <section className="py-10 md:py-12">
      <Container>
        <HomepageInlineText
          blockKey="seo_section_title"
          value={title}
          as="h2"
          className="text-2xl font-semibold text-gray-900"
        />
        <HomepageInlineText
          blockKey="seo_section_body"
          value={body}
          as="p"
          className="mt-4 max-w-4xl text-sm text-gray-600 md:text-base"
          multiline
        />
      </Container>
    </section>
  );
}

