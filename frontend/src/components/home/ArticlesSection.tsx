import { Container } from "@/components/layout/container";
import { HomepageInlineText } from "@/components/home/HomepageInlineText";
import { SectionHeader } from "@/components/home/SectionHeader";
import {
  ArticleCard,
  type ArticleCardData,
} from "@/components/articles/ArticleCard";

/**
 * Homepage «Статьи» — three newest articles rendered with THE shared
 * ArticleCard (articles-redesign rule: every article card render site uses
 * the same card). The section keeps the homepage header row; only the cards
 * come from the shared component.
 */

interface ArticlesSectionProps {
  articles: ArticleCardData[];
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
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3 md:gap-6">
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </Container>
    </section>
  );
}
