import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { CatalogPageTemplate } from "@/components/catalog/CatalogPageTemplate";

import { getCachedCatalogLandingModel } from "@/lib/cachedCatalogLanding";

import {

  buildLandingMetadata,

  isCitySlug,

  landingBreadcrumbCurrentLabel,

} from "@/lib/catalogSeoLanding";



interface CatalogLandingPageProps {

  params: Promise<{ city: string; catalogSegment: string }>;

}



export async function generateMetadata({

  params,

}: CatalogLandingPageProps): Promise<Metadata> {

  const { city, catalogSegment } = await params;

  if (!isCitySlug(city)) {

    return { title: "Страница не найдена" };

  }

  const model = await getCachedCatalogLandingModel(city, catalogSegment);

  if (!model) {

    return { title: "Страница не найдена" };

  }

  return buildLandingMetadata({

    city,

    catalogSegment,

    resolved: model.resolved,

  });

}



export default async function CatalogLandingPage({ params }: CatalogLandingPageProps) {

  const { city, catalogSegment } = await params;

  if (!isCitySlug(city)) {

    notFound();

  }

  const model = await getCachedCatalogLandingModel(city, catalogSegment);

  if (!model) {

    notFound();

  }



  const { filtered, h1, subtitle, seoText, seoLinks, resolved } = model;



  return (

    <CatalogPageTemplate

      breadcrumbs={[

        { label: "Главная", href: "/" },

        { label: "Каталог", href: "/catalog" },

        { label: landingBreadcrumbCurrentLabel(resolved) },

      ]}

      title={h1}

      subtitle={subtitle}

      properties={filtered}

      seoText={seoText}

      seoLinks={seoLinks}

      catalogSearchParams={{}}

      initialMapView={false}

    />

  );

}

