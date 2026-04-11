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

const seoText =
  "Centreal помогает купить недвижимость в Краснодаре и Геленджике: квартиры, дома, участки и коммерческие помещения. На сайте — актуальный каталог опубликованных объектов, статьи для покупателей и форма заявки по выбранному объекту.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    alternates: { canonical: `${siteOrigin()}/` },
  };
}

export default async function HomePage() {
  const [catalogItems, articlesRaw] = await Promise.all([
    fetchPublicPropertiesList(),
    fetchPublicArticlesList(),
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
        title="Найдите недвижимость вашей мечты"
        subtitle="Квартиры, дома, участки и коммерция в Краснодаре и Геленджике"
      />
      <HomeInquirySection />
      <CategoriesSection categories={categories} />
      <PropertiesSection properties={latestProperties} />
      <MapSection properties={catalogItems} />
      <ArticlesSection articles={articles} />
      <SeoTextSection text={seoText} />
      <SeoLinksFooter links={seoLinks} />
    </>
  );
}
