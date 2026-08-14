import type { Metadata } from "next";
import { HeroSection } from "@/components/home/HeroSection";
import { siteOrigin } from "@/lib/articleSeo";
import { HomeCatalogExplorer, type HomeCategory } from "@/components/home/HomeCatalogExplorer";
import { ArticlesSection } from "@/components/home/ArticlesSection";
import { articleCardDataFrom } from "@/components/articles/ArticleCard";
import { SellCtaSection } from "@/components/home/SellCtaSection";
import { SeoTextSection } from "@/components/home/SeoTextSection";
import { HomeInquiryCard } from "@/components/home/HomeInquiryCard";
import { fetchPublicArticlesList, listArticlesSorted } from "@/lib/publicArticles";
import { fetchPublicPropertiesList } from "@/lib/publicPropertyList";
import { fetchHomepageTextBlockMap } from "@/lib/homepageTextBlocks";
import { fetchCatalogLocationData } from "@/lib/publicLocations";

const categories: HomeCategory[] = [
  {
    id: "apartments",
    label: "Квартиры",
    description: "Городские варианты",
    propertyType: "apartment",
  },
  {
    id: "houses",
    label: "Дома",
    description: "Для семьи и отдыха",
    propertyType: "house",
  },
  {
    id: "land",
    label: "Участки",
    description: "Земля под строительство",
    propertyType: "land",
  },
  {
    id: "commercial",
    label: "Коммерция",
    description: "Офисы и помещения",
    propertyType: "commercial",
  },
];

/* The «Популярные запросы» SEO landing links used to live here as a homepage
   `seoLinks` array feeding `SeoLinksFooter`. They are now SITEWIDE, owned by
   `layout/footer.tsx` — see the Conflict-C reversal note in that file. */

export async function generateMetadata(): Promise<Metadata> {
  return {
    alternates: { canonical: `${siteOrigin()}/` },
  };
}

export default async function HomePage() {
  const [catalogItems, articlesRaw, hp, locationData] = await Promise.all([
    fetchPublicPropertiesList(),
    fetchPublicArticlesList(),
    fetchHomepageTextBlockMap(),
    // Same server-side dictionaries the catalog uses, so the hero's Город and
    // Район controls are populated in the SSR HTML instead of after a
    // browser round-trip through the /api rewrite.
    fetchCatalogLocationData(),
  ]);

  const articles = listArticlesSorted(articlesRaw)
    .slice(0, 3)
    .map(articleCardDataFrom);

  return (
    <>
      <HeroSection
        homepageText={{ hero_title: hp.hero_title, hero_subtitle: hp.hero_subtitle }}
        locationData={locationData}
      />
      <HomeCatalogExplorer
        properties={catalogItems}
        categories={categories}
        categoriesSectionTitle={hp.categories_section_title}
        propertiesSectionTitle={hp.properties_section_title}
        mapSectionTitle={hp.map_section_title}
        mapEmptyMessage={hp.map_empty_message}
      />
      <SellCtaSection />
      <ArticlesSection articles={articles} sectionTitle={hp.articles_section_title} />
      {/* «Остались вопросы?» is this section's right column, per the design's
          `.seo` 1.6fr/1fr grid — not a band of its own after the hero. */}
      <SeoTextSection
        title={hp.seo_section_title}
        body={hp.seo_section_body}
        aside={
          <HomeInquiryCard
            text={{
              inquiry_section_title: hp.inquiry_section_title,
              inquiry_section_subtitle: hp.inquiry_section_subtitle,
              inquiry_button_label: hp.inquiry_button_label,
              inquiry_modal_title: hp.inquiry_modal_title,
              inquiry_modal_subtitle: hp.inquiry_modal_subtitle,
            }}
          />
        }
      />
    </>
  );
}
