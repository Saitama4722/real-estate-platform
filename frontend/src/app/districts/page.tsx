import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { PageHeading } from "@/components/layout/page-heading";
import { ArticleCard } from "@/components/articles/ArticleCard";
import { districtsIndexCanonicalUrl } from "@/lib/districtGuideSeo";
import {
  districtGuideCardDataFrom,
  fetchPublicDistrictGuidesList,
  groupGuidesByCity,
} from "@/lib/publicDistrictGuides";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Районы Краснодара и Геленджика — гид по районам | Centreal",
    description:
      "Гиды по районам и микрорайонам Краснодара и Геленджика: чем живёт каждый район, кому подойдёт и где посмотреть объекты. Помогаем выбрать место для покупки.",
    alternates: { canonical: districtsIndexCanonicalUrl() },
  };
}

export default async function DistrictsPage() {
  const guides = await fetchPublicDistrictGuidesList();
  const groups = groupGuidesByCity(guides);

  return (
    <Container className="py-10">
      <PageHeading
        title="Районы"
        subtitle="Гиды по районам и микрорайонам Краснодара и Геленджика — чтобы выбрать место, а потом посмотреть объекты"
      />

      {groups.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center">
          <p className="text-base text-gray-700">Пока нет гидов по районам.</p>
          <p className="mt-1 text-sm text-gray-500">
            Мы готовим материалы о районах — загляните чуть позже.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-12">
          {groups.map((group) => (
            <section key={group.city.slug}>
              <h2 className="text-xl font-semibold text-gray-900">
                {group.city.name}
              </h2>
              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {group.guides.map((guide) => (
                  <ArticleCard
                    key={guide.slug}
                    article={districtGuideCardDataFrom(guide)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Container>
  );
}
