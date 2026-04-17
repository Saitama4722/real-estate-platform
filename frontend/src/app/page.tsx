import type { Metadata } from "next";
import { HeroSection } from "@/components/home/HeroSection";
import { siteOrigin } from "@/lib/articleSeo";
import { CategoriesSection } from "@/components/home/CategoriesSection";
import { PropertiesSection } from "@/components/home/PropertiesSection";
import { MapSection } from "@/components/home/MapSection";
import { ArticlesSection } from "@/components/home/ArticlesSection";
import { SeoTextSection } from "@/components/home/SeoTextSection";
import { SeoLinksFooter } from "@/components/home/SeoLinksFooter";
import { HomeInquirySection } from "@/components/home/HomeInquirySection";
import { fetchPublicArticlesList, listArticlesSorted } from "@/lib/publicArticles";
import { fetchPublicPropertiesList } from "@/lib/publicPropertyList";
import { fetchHomepageTextBlockMap } from "@/lib/homepageTextBlocks";

const categories = [
  {
    id: "apartments",
    label: "Квартиры",
    description: "Городские варианты",
    href: "/catalog?property_type=apartment",
  },
  {
    id: "houses",
    label: "Дома",
    description: "Для семьи и отдыха",
    href: "/catalog?property_type=house",
  },
  {
    id: "land",
    label: "Участки",
    description: "Земля под строительство",
    href: "/catalog?property_type=land",
  },
  {
    id: "commercial",
    label: "Коммерция",
    description: "Офисы и помещения",
    href: "/catalog?property_type=commercial",
  },
];

const seoLinks = [
  { label: "Купить квартиру в Краснодаре", href: "/krasnodar/kupit-kvartiru" },
  { label: "Купить дом в Краснодаре", href: "/krasnodar/kupit-dom" },
  { label: "Купить участок в Краснодаре", href: "/krasnodar/kupit-uchastok" },
  { label: "Купить квартиру в Геленджике", href: "/gelendzhik/kupit-kvartiru" },
  { label: "Купить дом в Геленджике", href: "/gelendzhik/kupit-dom" },
  {
    label: "Купить коммерцию в Краснодаре",
    href: "/krasnodar/kupit-kommercheskuyu-nedvizhimost",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  return {
    alternates: { canonical: `${siteOrigin()}/` },
  };
}

export default async function HomePage() {
  const [catalogItems, articlesRaw, hp] = await Promise.all([
    fetchPublicPropertiesList(),
    fetchPublicArticlesList(),
    fetchHomepageTextBlockMap(),
  ]);

  const latestProperties = catalogItems.slice(0, 6).map((p) => ({
    id: p.id,
    slug: p.slug,
    image: p.image,
    price: p.price,
    title: p.title,
    location: p.location,
  }));

  const articles = listArticlesSorted(articlesRaw).slice(0, 3).map((a) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
  }));

  return (
    <>
      <HeroSection
        homepageText={{ hero_title: hp.hero_title, hero_subtitle: hp.hero_subtitle }}
      />
      <HomeInquirySection
        text={{
          inquiry_section_title: hp.inquiry_section_title,
          inquiry_section_subtitle: hp.inquiry_section_subtitle,
          inquiry_button_label: hp.inquiry_button_label,
          inquiry_modal_title: hp.inquiry_modal_title,
          inquiry_modal_subtitle: hp.inquiry_modal_subtitle,
        }}
      />
      <CategoriesSection categories={categories} sectionTitle={hp.categories_section_title} />
      <PropertiesSection
        properties={latestProperties}
        sectionTitle={hp.properties_section_title}
      />
      <MapSection
        properties={catalogItems}
        sectionTitle={hp.map_section_title}
        emptyMessage={hp.map_empty_message}
      />
      <ArticlesSection articles={articles} sectionTitle={hp.articles_section_title} />
      <SeoTextSection title={hp.seo_section_title} body={hp.seo_section_body} />
      <SeoLinksFooter links={seoLinks} />
    </>
  );
}
