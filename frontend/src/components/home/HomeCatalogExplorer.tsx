"use client";

import { useMemo, useState } from "react";
import type { CatalogPropertyItem } from "@/components/catalog/types";
import { CategoriesSection } from "@/components/home/CategoriesSection";
import { PropertiesSection } from "@/components/home/PropertiesSection";
import { MapSection } from "@/components/home/MapSection";

/** Тип объекта, к которому фильтруется главная (совпадает с `CatalogPropertyItem.propertyType`). */
export type HomePropertyType = "apartment" | "house" | "land" | "commercial";

export interface HomeCategory {
  id: string;
  label: string;
  description: string;
  /** Тип объекта, по которому фильтруется список/карта при выборе категории. */
  propertyType: HomePropertyType;
}

interface HomeCatalogExplorerProps {
  /** Полный список опубликованных объектов (уже с `propertyType`). */
  properties: CatalogPropertyItem[];
  categories: HomeCategory[];
  categoriesSectionTitle: string;
  propertiesSectionTitle: string;
  mapSectionTitle: string;
  mapEmptyMessage: string;
}

/** Сколько карточек-превью показываем в блоке «Объекты» (как было в page.tsx). */
const PREVIEW_LIMIT = 6;

/**
 * Клиентская обёртка главной: категории, список-превью и карта делят одно
 * состояние активного фильтра по типу объекта. Клик по категории НЕ уводит на
 * /catalog — он фильтрует список и карту прямо на главной. Повторный клик по той
 * же категории (или «Все») сбрасывает фильтр. Данные не перезапрашиваются —
 * фильтрация чисто клиентская по уже загруженному массиву.
 */
export function HomeCatalogExplorer({
  properties,
  categories,
  categoriesSectionTitle,
  propertiesSectionTitle,
  mapSectionTitle,
  mapEmptyMessage,
}: HomeCatalogExplorerProps) {
  const [activeType, setActiveType] = useState<HomePropertyType | null>(null);

  const filtered = useMemo(
    () =>
      activeType === null
        ? properties
        : properties.filter((p) => p.propertyType === activeType),
    [properties, activeType],
  );

  /**
   * Just a slice — deliberately NOT a field-by-field .map().
   *
   * It used to re-map each item into a narrow object literal, which silently
   * dropped every field the literal didn't mention: the homepage cards rendered
   * with NO spec line because `rooms`/`area`/`floor`/`totalFloors` (and
   * `characteristics`) never reached PropertyCard, even though the data was
   * right there on `filtered`. Same failure shape as the ArticlesSection
   * `coverImage` omission. Passing the items through means any field PropertyCard
   * grows later arrives on its own instead of needing a fix in three places.
   */
  const previewProperties = useMemo(
    () => filtered.slice(0, PREVIEW_LIMIT),
    [filtered],
  );

  const activeCategoryId = useMemo(
    () => categories.find((c) => c.propertyType === activeType)?.id ?? null,
    [categories, activeType],
  );

  const handleSelectCategory = (id: string | null) => {
    if (id === null) {
      setActiveType(null);
      return;
    }
    const next = categories.find((c) => c.id === id)?.propertyType ?? null;
    // Повторный клик по активной категории — снять фильтр.
    setActiveType((cur) => (next !== null && cur === next ? null : next));
  };

  return (
    <>
      <CategoriesSection
        categories={categories}
        sectionTitle={categoriesSectionTitle}
        activeCategoryId={activeCategoryId}
        onSelectCategory={handleSelectCategory}
      />
      <PropertiesSection
        properties={previewProperties}
        sectionTitle={propertiesSectionTitle}
      />
      <MapSection
        properties={filtered}
        sectionTitle={mapSectionTitle}
        emptyMessage={mapEmptyMessage}
      />
    </>
  );
}
