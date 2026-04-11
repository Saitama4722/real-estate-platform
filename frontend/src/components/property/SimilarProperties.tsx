import { CatalogPropertyItem } from "@/components/catalog/types";
import { PropertyCard } from "@/components/home/PropertyCard";
import { fetchPublicPropertiesList } from "@/lib/publicPropertyList";
import { getSimilarProperties } from "@/lib/similarProperties";

interface SimilarPropertiesProps {
  current: CatalogPropertyItem;
}

export async function SimilarProperties({ current }: SimilarPropertiesProps) {
  const pool = await fetchPublicPropertiesList(
    current.citySlug
      ? { searchParams: { city_slug: current.citySlug } }
      : undefined,
  );
  const similar = getSimilarProperties(current, pool, 8);

  if (similar.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-gray-900">Похожие объявления</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {similar.map((property) => (
          <PropertyCard
            key={property.id}
            slug={property.slug}
            image={property.image}
            price={property.price}
            title={property.title}
            characteristics={property.characteristics}
            location={property.location}
            href={property.href}
          />
        ))}
      </div>
    </section>
  );
}
