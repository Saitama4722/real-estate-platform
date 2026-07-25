import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { PageHeading } from "@/components/layout/page-heading";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { isPropertyImageUrl } from "@/lib/propertyMedia";
import {
  fetchPublicDistrictGuideBySlug,
  buildGuideCatalogHref,
} from "@/lib/publicDistrictGuides";
import {
  buildGuideDocumentTitle,
  buildGuideMetaDescription,
  buildGuideJsonLd,
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

  const jsonLd = buildGuideJsonLd(guide);
  const catalogHref = buildGuideCatalogHref(guide);

  // Breadcrumbs: Главная > Районы > [город] > [название].
  const cityCrumb = guide.city
    ? {
        label: guide.city.name,
        href: `/catalog?city_slug=${encodeURIComponent(guide.city.slug)}`,
      }
    : null;

  return (
    <Container className="py-6">
      <JsonLd data={jsonLd} />
      <Breadcrumbs
        items={[
          { label: "Главная", href: "/" },
          { label: "Районы", href: "/districts" },
          ...(cityCrumb ? [cityCrumb] : []),
          { label: guide.title },
        ]}
        className="mb-4"
      />

      <article>
        <PageHeading title={guide.title} />

        {guide.coverImage && isPropertyImageUrl(guide.coverImage) && (
          <div className="mt-6 aspect-[16/9] w-full max-w-3xl overflow-hidden rounded-lg bg-gray-200">
            <img
              src={guide.coverImage}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="mt-8 max-w-3xl whitespace-pre-line text-base leading-relaxed text-gray-800">
          {guide.body}
        </div>

        {/* CTA: read about the area → browse real listings filtered to it. */}
        <div className="mt-10 max-w-3xl rounded-xl border border-blue-100 bg-blue-50 p-6">
          <p className="text-base font-medium text-gray-900">
            Хотите посмотреть объекты в этом районе?
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Мы уже отфильтровали каталог по этому месту — переходите и выбирайте.
          </p>
          <Link
            href={catalogHref}
            className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Смотреть объекты в этом районе
          </Link>
        </div>
      </article>
    </Container>
  );
}
