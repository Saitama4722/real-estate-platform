import { CatalogPropertyItem } from "@/components/catalog/types";

interface PropertyDescriptionProps {
  property: CatalogPropertyItem;
}

const TYPE_HEADINGS: Record<string, string> = {
  apartment: "О квартире",
  house: "О доме",
  land: "Об участке",
  commercial: "О помещении",
};

export function PropertyDescription({ property }: PropertyDescriptionProps) {
  if (!property.description) {
    return null;
  }

  const heading =
    (property.propertyType && TYPE_HEADINGS[property.propertyType]) ??
    "Об объекте";

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold text-gray-900">{heading}</h2>
      <p className="mt-4 text-base leading-relaxed text-gray-700">
        {property.description}
      </p>
    </div>
  );
}
