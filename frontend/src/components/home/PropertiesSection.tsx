import { Container } from "@/components/layout/container";
import { PropertyCard } from "@/components/home/PropertyCard";
import { HomepageInlineText } from "@/components/home/HomepageInlineText";
import { SectionHeader } from "@/components/home/SectionHeader";

/**
 * Structurally a subset of CatalogPropertyItem — the homepage passes those
 * objects straight through.
 *
 * ⚠ This interface previously omitted the spec fields, so the homepage cards
 * rendered price → title → address with NO spec line at all, even though the
 * data was present on the objects at runtime. Declaring a field here is what
 * makes it forwardable; same failure shape as the ArticlesSection `coverImage`
 * omission. Keep this in sync when PropertyCard grows a displayed field.
 */
interface PropertyItem {
  id: number;
  slug?: string;
  image: string;
  price: string;
  title: string;
  characteristics?: string;
  location: string;
  isPriceReduced?: boolean;
  isNew?: boolean;
  oldPrice?: string;
  marketLabel?: string;
  propertyType?: "apartment" | "house" | "land" | "commercial";
  rooms?: number;
  area?: number;
  floor?: number;
  totalFloors?: number;
}

interface PropertiesSectionProps {
  properties: PropertyItem[];
  sectionTitle: string;
}

export function PropertiesSection({ properties, sectionTitle }: PropertiesSectionProps) {
  return (
    <section className="ctr-sec">
      <Container>
        <SectionHeader moreHref="/catalog" moreLabel="Весь каталог">
          <HomepageInlineText
            blockKey="properties_section_title"
            value={sectionTitle}
            as="h2"
            /* Size/weight from the base `h2` rule — see CategoriesSection. */
            className="text-fg"
          />
        </SectionHeader>
        {/* Kit gap is 24px at desktop. The md:2-col step is ours — the kit only
            specifies 1 col (390) and 3 cols (1440), with nothing in between. */}
        <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              slug={property.slug}
              image={property.image}
              price={property.price}
              oldPrice={property.oldPrice}
              marketLabel={property.marketLabel}
              title={property.title}
              characteristics={property.characteristics}
              rooms={property.rooms}
              area={property.area}
              floor={property.floor}
              totalFloors={property.totalFloors}
              location={property.location}
              favoriteId={property.slug}
              isPriceReduced={property.isPriceReduced}
              isNew={property.isNew}
              compareId={property.slug}
              compareType={property.propertyType}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}

