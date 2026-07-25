import { CatalogPropertyItem } from "@/components/catalog/types";
import { PropertyCard } from "@/components/home/PropertyCard";
import { fetchPublicPropertiesList } from "@/lib/publicPropertyList";
import { getSimilarProperties } from "@/lib/similarProperties";

interface SimilarPropertiesProps {
  current: CatalogPropertyItem;
}

const TARGET_COUNT = 4;

/**
 * "Похожие объекты" — same-type published properties, ranked by locality + price.
 *
 * Progressive fallback: fetch same city first (locality is the best signal after
 * type); if that yields fewer than the target, broaden to ALL cities so a sparse
 * city still shows relevant cross-city matches rather than an empty section.
 * getSimilarProperties() hard-filters by property type, so broadening never mixes
 * in a different type. Renders nothing when there are no similar properties.
 */
export async function SimilarProperties({ current }: SimilarPropertiesProps) {
  // First pass: same city (if the property has one).
  let similar: CatalogPropertyItem[] = [];
  if (current.citySlug) {
    const cityPool = await fetchPublicPropertiesList({
      searchParams: { city_slug: current.citySlug, property_type: current.propertyType },
    });
    similar = getSimilarProperties(current, cityPool, TARGET_COUNT);
  }

  // Fallback: broaden to all cities if the city pass didn't fill the row.
  if (similar.length < TARGET_COUNT) {
    const widePool = await fetchPublicPropertiesList({
      searchParams: { property_type: current.propertyType },
    });
    similar = getSimilarProperties(current, widePool, TARGET_COUNT);
  }

  if (similar.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-gray-900">Похожие объекты</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {similar.map((property) => (
          <PropertyCard
            key={property.id}
            slug={property.slug}
            image={property.image}
            price={property.price}
            title={property.title}
            characteristics={property.characteristics}
            rooms={property.rooms}
            area={property.area}
            floor={property.floor}
            totalFloors={property.totalFloors}
            location={property.location}
            href={property.href}
            favoriteId={property.slug}
            isPriceReduced={property.isPriceReduced}
            compareId={property.slug}
            compareType={property.propertyType}
          />
        ))}
      </div>
    </section>
  );
}
