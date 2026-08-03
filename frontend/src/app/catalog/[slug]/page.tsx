import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Icon } from "@/components/ui/icon";
import { PropertySpecTiles } from "@/components/property/PropertySpecTiles";
import { PropertyTitleActions } from "@/components/property/PropertyTitleActions";
import type { ComparePropertyType } from "@/lib/compare";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PropertyGallery } from "@/components/property/PropertyGallery";
import { PropertyCharacteristics } from "@/components/property/PropertyCharacteristics";
import { PropertyDescription } from "@/components/property/PropertyDescription";
import { PriceHistoryChart } from "@/components/property/PriceHistoryChart";
import { PropertyPriceCard } from "@/components/property/PropertyPriceCard";
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

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
          <div className="min-w-0">
            <h1 className="max-w-[760px] text-h2 tracking-tight text-fg text-pretty md:text-[34px] md:leading-[1.14]">
              {h1}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[15px] text-fg-secondary">
              <span className="flex items-center gap-1.5">
                <Icon icon={MapPin} className="size-4 text-fg-muted" />
                {property.location}
              </span>
              <span className="size-1 rounded-full bg-border-strong" />
              <span className="text-fg-muted">Объект #{property.id}</span>
            </div>
          </div>
          <PropertyTitleActions
            slug={pathSlug}
            propertyType={property.propertyType as ComparePropertyType}
          />
        </div>

        {/* Split layout: content left, sticky price/agent card right. The right
            column is a fixed 388px on desktop and stacks above nothing on
            mobile — the aside simply flows after the content. */}
        {/* Three grid children, explicitly placed on desktop so that MOBILE
            DOM ORDER can differ from the desktop columns without duplicating
            anything: gallery → price/agent → the rest. The mobile design puts
            the price directly under the photos, and stacking the aside last
            would have buried it under every content card. */}
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_388px] lg:gap-x-7 lg:gap-y-4">
          <div className="order-1 min-w-0 lg:col-start-1 lg:row-start-1">
            <PropertyGallery
              gallery={property.gallery}
              videoUrl={property.videoUrl}
              mainImage={property.image}
              isPriceReduced={property.isPriceReduced}
              title={property.location}
            />
          </div>

          {/* order-3 on mobile puts the content cards AFTER the price/agent
              aside (order-2). Explicit lg: placement below wins over `order`,
              so the desktop columns are unaffected. */}
          <div className="order-3 flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-2">
            <PropertySpecTiles property={property} />
            <PropertyCharacteristics property={property} />
            <PriceHistoryChart history={property.priceHistory} />
            <PropertyDescription property={property} />
            <PropertyMapWrapper
              latitude={property.latitude}
              longitude={property.longitude}
              showMap={hasPublicGeoStrings(raw.public_latitude, raw.public_longitude)}
              locationLabel={property.location}
            />
          </div>

          <aside className="order-2 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            {/* top-[88px] clears the sticky header. max-h + overflow-y means a
                short viewport scrolls the card's own content instead of
                trapping the buttons off-screen, and `self-start` keeps the
                sticky context from stretching to the grid row height (which
                would stop it sticking at all). */}
            <div className="flex flex-col gap-3 lg:sticky lg:top-[88px] lg:max-h-[calc(100dvh-104px)] lg:self-start lg:overflow-y-auto">
              {/* One unified card: price → hairline → realtor → id footer. */}
              <PropertyPriceCard property={property}>
                <PropertyContactBlock
                  propertyId={property.id}
                  realtorName={property.realtorName}
                  realtorAvatar={property.realtorAvatar}
                  realtorCrmId={property.realtorCrmId}
                />
              </PropertyPriceCard>
            </div>
          </aside>
        </div>

        <SimilarProperties current={property} />
      </Container>
    </div>
  );
}
