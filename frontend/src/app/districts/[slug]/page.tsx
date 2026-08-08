import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCatalogCta } from "@/components/articles/ArticleCatalogCta";
import { ArticleReadingPage } from "@/components/articles/ArticleReadingPage";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  parsedBodyFromSections,
  readingTimeFromSections,
} from "@/lib/articleContent";
import {
  buildGuideCatalogHref,
  fetchPublicDistrictGuideBySlug,
  guideSections,
  guideTakeaway,
} from "@/lib/publicDistrictGuides";
import {
  buildGuideDocumentTitle,
  buildGuideJsonLd,
  buildGuideMetaDescription,
  guideCanonicalUrl,
} from "@/lib/districtGuideSeo";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = await fetchPublicDistrictGuideBySlug(slug);
  if (!guide) {
    return { title: "Гид по району не найден" };
  }
  return {
    title: buildGuideDocumentTitle(guide),
    description: buildGuideMetaDescription(guide),
    alternates: { canonical: guideCanonicalUrl(guide.slug) },
  };
}

export default async function DistrictGuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = await fetchPublicDistrictGuideBySlug(slug);
  if (!guide) {
    notFound();
  }

  const sections = guideSections(guide);
  const takeaway = guideTakeaway(guide);

  const cityCrumb = guide.city
    ? {
        label: guide.city.name,
        href: `/catalog?city_slug=${encodeURIComponent(guide.city.slug)}`,
      }
    : null;

  return (
    <>
      <JsonLd data={buildGuideJsonLd(guide)} />
      <ArticleReadingPage
        breadcrumbs={[
          { label: "Главная", href: "/" },
          { label: "Районы", href: "/districts" },
          ...(cityCrumb ? [cityCrumb] : []),
          { label: guide.title },
        ]}
        /* Same eyebrow the guide card shows. Not a link: there is no
           /districts?kind= filter to send the reader to. */
        eyebrow={
          guide.catalogParam === "neighborhood_slug" ? "Микрорайон" : "Район"
        }
        title={guide.title}
        publishedAt={guide.publishedAt}
        /* Counted from the sections here — the detail payload HAS them. The
           index derives the same number from `word_count`, which the
           serializer sums over the same rendered parts, through the same
           rule. */
        minutes={readingTimeFromSections(sections, takeaway)}
        coverImage={guide.coverImage}
        parsed={parsedBodyFromSections(sections, takeaway)}
        shareUrl={guideCanonicalUrl(guide.slug)}
        /* A guide's "up" is the district index, not the blog. */
        backHref="/districts"
        backLabel="Все районы"
        cta={
          /* The guide's CTA is area-targeted: the catalog is pre-filtered to
             THIS district/neighborhood, which beats the article version's
             generic links. Same component, different data. */
          <ArticleCatalogCta
            title="Объекты в этом районе"
            description="Каталог уже отфильтрован по этому месту — посмотрите, что продаётся здесь сейчас."
            primaryHref={buildGuideCatalogHref(guide)}
            primaryLabel="Смотреть объекты"
            links={[{ label: "Все районы", href: "/districts" }]}
            glyph="Р"
          />
        }
      />
    </>
  );
}
