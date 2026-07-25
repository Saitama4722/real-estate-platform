import { Container } from "@/components/layout/container";
import { HomepageInlineText } from "@/components/home/HomepageInlineText";

interface SeoTextSectionProps {
  title: string;
  body: string;
  /**
   * Right-hand column (design `.seo` is a 1.6fr / 1fr grid). The homepage passes
   * the «Остались вопросы?» card here. Optional so other pages can reuse the
   * section as a single full-width column.
   */
  aside?: React.ReactNode;
}

export function SeoTextSection({ title, body, aside }: SeoTextSectionProps) {
  return (
    <section className="ctr-sec">
      <Container>
        {/* 1.6fr text / 1fr aside from md up; stacked below. Gap 20px mobile →
            24px desktop, matching the kit's `.ask` margin-top and `.seo` gap. */}
        <div
          className={
            aside
              ? "grid items-start gap-5 md:grid-cols-[1.6fr_1fr] md:gap-6"
              : undefined
          }
        >
          <div>
            <HomepageInlineText
              blockKey="seo_section_title"
              value={title}
              as="h2"
              /* Size/weight from the base `h2` rule — see CategoriesSection. */
              className="text-fg"
            />
            <HomepageInlineText
              blockKey="seo_section_body"
              value={body}
              as="p"
              className="mt-3.5 max-w-[640px] text-small text-fg-secondary md:text-body"
              multiline
            />
          </div>
          {aside}
        </div>
      </Container>
    </section>
  );
}

