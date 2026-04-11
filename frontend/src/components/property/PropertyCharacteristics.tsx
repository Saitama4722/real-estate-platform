import { CatalogPropertyItem } from "@/components/catalog/types";

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
    <div className="mt-6">
      <h2 className="text-xl font-semibold text-gray-900">Характеристики</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {allCharacteristics.map((item, index) => (
          <div
            key={index}
            className="flex justify-between border-b border-gray-200 pb-2"
          >
            <span className="text-sm text-gray-600">{item.label}</span>
            <span className="text-sm font-medium text-gray-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
