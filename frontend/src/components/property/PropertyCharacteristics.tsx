import { CatalogPropertyItem } from "@/components/catalog/types";
import { PropertySection } from "@/components/property/PropertySection";

interface PropertyCharacteristicsProps {
  property: CatalogPropertyItem;
}

interface CharacteristicItem {
  label: string;
  value: string | number;
}

export function PropertyCharacteristics({ property }: PropertyCharacteristicsProps) {
  const mainCharacteristics: CharacteristicItem[] = [];

  if (property.rooms) {
    mainCharacteristics.push({
      label: "Комнат",
      value: property.rooms,
    });
  }

  if (property.area) {
    const areaLabel = property.propertyType === "land" ? "Площадь участка" : "Площадь";
    const areaValue = property.propertyType === "land" 
      ? `${property.area} соток` 
      : `${property.area} м²`;
    mainCharacteristics.push({
      label: areaLabel,
      value: areaValue,
    });
  }

  if (property.floor) {
    mainCharacteristics.push({
      label: "Этаж",
      value: property.totalFloors ? `${property.floor}/${property.totalFloors}` : property.floor,
    });
  }

  if (property.district) {
    mainCharacteristics.push({
      label: "Район",
      value: property.district,
    });
  }

  const additionalCharacteristics: CharacteristicItem[] = [];

  if (property.details) {
    const { details } = property;

    if (details.ceilingHeight) {
      additionalCharacteristics.push({
        label: "Высота потолков",
        value: details.ceilingHeight,
      });
    }

    if (details.kitchenArea) {
      additionalCharacteristics.push({
        label: "Площадь кухни",
        value: details.kitchenArea,
      });
    }

    if (details.balcony) {
      additionalCharacteristics.push({
        label: "Балкон",
        value: details.balcony,
      });
    }

    if (details.renovation) {
      additionalCharacteristics.push({
        label: "Ремонт",
        value: details.renovation,
      });
    }

    if (details.plotArea) {
      additionalCharacteristics.push({
        label: "Площадь участка",
        value: details.plotArea,
      });
    }

    if (details.houseFloors) {
      additionalCharacteristics.push({
        label: "Этажность дома",
        value: details.houseFloors,
      });
    }

    if (details.material) {
      additionalCharacteristics.push({
        label: "Материал",
        value: details.material,
      });
    }

    if (details.sauna !== undefined) {
      additionalCharacteristics.push({
        label: "Баня",
        value: details.sauna ? "Есть" : "Нет",
      });
    }

    if (details.garage !== undefined) {
      additionalCharacteristics.push({
        label: "Гараж",
        value: details.garage ? "Есть" : "Нет",
      });
    }

    if (details.purpose) {
      additionalCharacteristics.push({
        label: "Назначение",
        value: details.purpose,
      });
    }

    if (details.roadAccess) {
      additionalCharacteristics.push({
        label: "Подъезд",
        value: details.roadAccess,
      });
    }

    if (details.communications) {
      additionalCharacteristics.push({
        label: "Коммуникации",
        value: details.communications,
      });
    }

    if (details.entrance) {
      additionalCharacteristics.push({
        label: "Вход",
        value: details.entrance,
      });
    }

    if (details.line) {
      additionalCharacteristics.push({
        label: "Линия",
        value: details.line,
      });
    }

    if (details.parking !== undefined) {
      additionalCharacteristics.push({
        label: "Парковка",
        value: details.parking ? "Есть" : "Нет",
      });
    }
  }

  const allCharacteristics = [...mainCharacteristics, ...additionalCharacteristics];

  if (allCharacteristics.length === 0) {
    return null;
  }

  return (
    <PropertySection title="Характеристики" bodyClassName="-mb-3">
      {/* Two columns from md up, one below. The list is built above from
          whatever the listing actually has — 2 rows for a bare land plot, 15+
          for a fully filled apartment — so nothing here assumes a row count. */}
      <div className="grid md:grid-cols-2 md:gap-x-11">
        {allCharacteristics.map((item, index) => (
          <div
            key={index}
            className="flex items-baseline gap-2 border-b border-border py-3"
          >
            <span className="text-sm text-fg-muted md:text-[14.5px]">
              {item.label}
            </span>
            {/* The leader: a flexible baseline rule between label and value.
                -translate-y-[3px] drops it off the text baseline onto the
                optical line the dots should sit on. */}
            <span
              aria-hidden="true"
              className="min-w-4 flex-1 -translate-y-[3px] border-b border-dotted border-border-strong"
            />
            <span className="text-right text-sm font-semibold text-fg md:text-[14.5px]">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </PropertySection>
  );
}
