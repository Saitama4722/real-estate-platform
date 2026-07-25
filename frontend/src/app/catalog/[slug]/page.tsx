import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PropertyGallery } from "@/components/property/PropertyGallery";
import { PropertyCharacteristics } from "@/components/property/PropertyCharacteristics";
import { PropertyDescription } from "@/components/property/PropertyDescription";
import { PriceDropBadge } from "@/components/property/PriceDropBadge";
import { PriceHistoryChart } from "@/components/property/PriceHistoryChart";
import { PropertyContactBlock } from "@/components/property/PropertyContactBlock";
import { PropertyMapWrapper } from "@/components/property/PropertyMapWrapper";
import { SimilarProperties } from "@/components/property/SimilarProperties";
import {
  buildPropertyH1,
  buildPropertyMetaDescription,
  buildPropertyPageTitle,
  propertyPageCanonicalUrl,
} from "@/lib/propertySeo";
import { buildPropertyJsonLd } from "@/lib/propertyStructuredData";
import {
  buildPropertyBreadcrumbs,
  buildBreadcrumbJsonLd,
} from "@/lib/propertyBreadcrumbs";
import { hasPublicGeoStrings } from "@/lib/mapCoordinates";
import {
  fetchPublicPropertyBySlug,
  mapPublicDetailToCatalogItem,
} from "@/lib/publicProperty";
import { JsonLd } from "@/components/seo/JsonLd";

interface PropertyPageProps {
  params: Promise<{ slug: string }>;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function generateMetadata({ params }: PropertyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const raw = await fetchPublicPropertyBySlug(slug);
  if (!raw) {
    return { title: "Объект не найден" };
  }
  const pathSlug = (raw.slug ?? slug).trim();
  const canonical = propertyPageCanonicalUrl(pathSlug);

  return {
    title: buildPropertyPageTitle(raw),
    description: buildPropertyMetaDescription(raw),
    alternates: { canonical },
  };
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { slug } = await params;
  const raw = await fetchPublicPropertyBySlug(slug);
  if (!raw) {
    notFound();
  }

  const pathSlug = (raw.slug ?? slug).trim();
  const property = mapPublicDetailToCatalogItem(raw, pathSlug);
  const h1 = buildPropertyH1(raw);
  const jsonLd = buildPropertyJsonLd(raw, pathSlug);
  const breadcrumbItems = buildPropertyBreadcrumbs(property);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbItems);

  return (
    <div className="py-6 md:py-8">
      <JsonLd data={[jsonLd, breadcrumbJsonLd]} />
      <Container>
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PropertyGallery
              gallery={property.gallery}
              videoUrl={property.videoUrl}
              mainImage={property.image}
            />

            <div className="mt-6">
              <h1 className="text-3xl font-bold text-gray-900">{h1}</h1>
              <p className="mt-2 text-sm text-gray-600">{property.location}</p>
            </div>

            <div className="mt-6">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                <p className="text-4xl font-bold text-gray-900">{property.price}</p>
                {property.isPriceReduced && <PriceDropBadge />}
                {property.updatedAt && (
                  <p className="text-sm text-gray-500">
                    Обновлено: {formatDate(property.updatedAt)}
                  </p>
                )}
              </div>
            </div>

            <PropertyCharacteristics property={property} />
            <PriceHistoryChart history={property.priceHistory} />
            <PropertyDescription property={property} />
            <PropertyMapWrapper
              latitude={property.latitude}
              longitude={property.longitude}
              showMap={hasPublicGeoStrings(raw.public_latitude, raw.public_longitude)}
            />
          </div>

          <div className="lg:col-span-1">
            <PropertyContactBlock
              propertyId={property.id}
              realtorName={property.realtorName}
              realtorAvatar={property.realtorAvatar}
              realtorCrmId={property.realtorCrmId}
            />
          </div>
        </div>

        <SimilarProperties current={property} />
      </Container>
    </div>
  );
}
