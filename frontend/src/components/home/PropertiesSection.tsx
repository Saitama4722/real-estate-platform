import { Container } from "@/components/layout/container";
import { PropertyCard } from "@/components/home/PropertyCard";
import { HomepageInlineText } from "@/components/home/HomepageInlineText";

interface PropertyItem {
  id: number;
  slug?: string;
  image: string;
  price: string;
  title: string;
  location: string;
}

interface PropertiesSectionProps {
  properties: PropertyItem[];
  sectionTitle: string;
}

export function PropertiesSection({ properties, sectionTitle }: PropertiesSectionProps) {
  return (
    <section className="py-10 md:py-12">
      <Container>
        <HomepageInlineText
          blockKey="properties_section_title"
          value={sectionTitle}
          as="h2"
          className="text-2xl font-semibold text-gray-900"
        />
        <div className="mt-5 grid gap-4 md:mt-6 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              slug={property.slug}
              image={property.image}
              price={property.price}
              title={property.title}
              location={property.location}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}

