import Link from "next/link";
import { Container } from "@/components/layout/container";
import { HomepageInlineText } from "@/components/home/HomepageInlineText";
import { SectionHeader } from "@/components/home/SectionHeader";
import { Icon, Icons } from "@/components/ui/icon";
import { isPropertyImageUrl } from "@/lib/propertyMedia";

interface ArticleItem {
  slug: string;
  title: string;
  excerpt: string;
  coverImage?: string | null;
}

interface ArticlesSectionProps {
  articles: ArticleItem[];
  sectionTitle: string;
}

export function ArticlesSection({ articles, sectionTitle }: ArticlesSectionProps) {
  if (articles.length === 0) return null;

  return (
    <section className="ctr-sec">
      <Container>
        <SectionHeader moreHref="/articles" moreLabel="Все статьи">
          <HomepageInlineText
            blockKey="articles_section_title"
            value={sectionTitle}
            as="h2"
            /* Size/weight from the base `h2` rule — see CategoriesSection. */
            className="text-fg"
          />
        </SectionHeader>
        <div className="grid gap-3.5 md:grid-cols-3 md:gap-6">
          {articles.map((article) => {
            const hasCover = Boolean(
              article.coverImage && isPropertyImageUrl(article.coverImage),
            );
            return (
            /* Shadow depth + photo ×1.04 as elsewhere, but a 2px lift — the kit
               gives `.art` and `.cat` 2px and reserves 3px for `.ctr-card`.
               Transition names `translate`, not `transform` (v4 compiles the
               lift to the `translate` property).

               The WHOLE card is one <Link>, as in the kit. Safe here precisely
               because an article card contains no nested interactive elements —
               unlike PropertyCard, which needs an overlay anchor to keep its
               favourite/compare buttons clickable and tabbable. */
            <Link
              key={article.slug}
              href={`/articles/${article.slug}`}
              className="group flex flex-col overflow-hidden rounded-xl bg-surface-raised shadow-sm transition-[box-shadow,translate] duration-[250ms] ease-out hover:-translate-y-[2px] hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              {hasCover && (
                <div className="h-32 w-full overflow-hidden bg-surface-inset">
                  <img
                    src={article.coverImage as string}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-[250ms] ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col p-5 md:p-[26px]">
                <h3 className="text-[17px] leading-6 font-semibold text-fg transition-colors duration-150 ease-out group-hover:text-brand md:text-[18px] md:leading-[26px]">
                  {article.title}
                </h3>
                <p className="mt-2.5 text-[13px] leading-[19px] text-fg-secondary md:text-small">
                  {article.excerpt}
                </p>
                {/* Visual affordance only — the card itself is the link, so this
                    must NOT be another anchor (it would duplicate every article
                    link in the tab order and the accessibility tree). */}
                <span
                  aria-hidden="true"
                  className="mt-auto inline-flex items-center gap-1.5 pt-3 text-[14px] leading-5 font-medium text-brand"
                >
                  Читать статью
                  <Icon icon={Icons.ArrowRight} size={16} className="shrink-0" />
                </span>
              </div>
            </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
