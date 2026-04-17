import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyCard } from "@/components/home/PropertyCard";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Container } from "@/components/layout/container";
import { Card, CardContent } from "@/components/ui/card";
import { siteOrigin } from "@/lib/articleSeo";
import { isPropertyImageUrl } from "@/lib/propertyMedia";
import { fetchPublicPropertiesList } from "@/lib/publicPropertyList";
import { fetchPublicRealtorByCrmId } from "@/lib/publicRealtor";

const TITLE_SUFFIX = " — Centreal";

interface RealtorPageProps {
  params: Promise<{ crmId: string }>;
}

export async function generateMetadata({ params }: RealtorPageProps): Promise<Metadata> {
  const { crmId } = await params;
  const realtor = await fetchPublicRealtorByCrmId(crmId);
  if (!realtor) {
    return { title: "Риэлтор не найден" };
  }
  const origin = siteOrigin();
  const path = `/realtors/${encodeURIComponent(realtor.crm_id)}`;
  const description =
    (realtor.short_bio || "").trim() ||
    `${realtor.display_name} — риэлтор Centreal. Объектов в продаже: ${realtor.published_properties_count}.`;

  return {
    title: `${realtor.display_name}${TITLE_SUFFIX}`,
    description: description.slice(0, 160),
    alternates: { canonical: `${origin}${path}` },
  };
}

function RealtorPageAvatar({ name, avatar }: { name: string; avatar: string | null }) {
  if (avatar && isPropertyImageUrl(avatar)) {
    return (
      <img
        src={avatar}
        alt={name}
        className="h-28 w-28 rounded-full object-cover ring-2 ring-gray-100 md:h-32 md:w-32"
        loading="eager"
        decoding="async"
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-28 w-28 items-center justify-center rounded-full bg-blue-100 text-2xl font-semibold text-blue-800 ring-2 ring-gray-100 md:h-32 md:w-32">
      {initials || "—"}
    </div>
  );
}

export default async function PublicRealtorPage({ params }: RealtorPageProps) {
  const { crmId } = await params;
  const realtor = await fetchPublicRealtorByCrmId(crmId);
  if (!realtor) {
    notFound();
  }

  const properties = await fetchPublicPropertiesList({
    searchParams: { assigned_realtor_crm_id: realtor.crm_id },
  });

  const telHref = realtor.phone ? `tel:${realtor.phone.replace(/\s+/g, "")}` : null;

  return (
    <div className="py-6 md:py-8">
      <Container>
        <Breadcrumbs
          items={[
            { label: "Главная", href: "/" },
            { label: "Каталог", href: "/catalog" },
            { label: realtor.display_name },
          ]}
        />

        <div className="mt-8 flex flex-col gap-8 md:flex-row md:items-start">
          <div className="flex flex-col items-center gap-4 md:items-start">
            <RealtorPageAvatar name={realtor.display_name} avatar={realtor.avatar} />
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <p className="text-sm font-medium uppercase tracking-wide text-gray-500">Риэлтор</p>
            <h1 className="text-3xl font-bold text-gray-900">{realtor.display_name}</h1>
            <p className="text-sm text-gray-600">
              Объектов в продаже:{" "}
              <span className="font-medium text-gray-900">{realtor.published_properties_count}</span>
            </p>
            {realtor.short_bio ? (
              <p className="max-w-2xl text-base leading-relaxed text-gray-700">{realtor.short_bio}</p>
            ) : null}
            <Card className="max-w-md border-gray-200">
              <CardContent className="space-y-3 pt-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Телефон</p>
                  {realtor.phone ? (
                    <p className="mt-1 text-lg font-medium text-gray-900">{realtor.phone}</p>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500">Телефон уточняйте по объектам.</p>
                  )}
                </div>
                {telHref ? (
                  <Link
                    href={telHref}
                    className="inline-flex h-10 w-full items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 sm:w-auto"
                  >
                    Связаться
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>

        <section className="mt-12 border-t border-gray-200 pt-10">
          <h2 className="text-xl font-semibold text-gray-900">Объекты риэлтора</h2>
          {properties.length === 0 ? (
            <p className="mt-4 text-sm text-gray-600">Сейчас нет опубликованных объектов у этого риэлтора.</p>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((p) => (
                <PropertyCard
                  key={p.id}
                  slug={p.slug}
                  image={p.image}
                  price={p.price}
                  title={p.title}
                  characteristics={p.characteristics}
                  location={p.location}
                  href={p.href}
                />
              ))}
            </div>
          )}
        </section>
      </Container>
    </div>
  );
}
