"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PropertyCard } from "@/components/home/PropertyCard";
import type { CatalogPropertyItem } from "@/components/catalog/types";

interface RealtorPropertiesToggleProps {
  properties: CatalogPropertyItem[];
}

/**
 * Сетка объектов риэлтора скрыта по умолчанию — раскрывается по кнопке
 * «Показать объекты (N)» без перехода на другую страницу. Данные приходят
 * пропом (загружены на сервере), клиент только переключает видимость.
 */
export function RealtorPropertiesToggle({ properties }: RealtorPropertiesToggleProps) {
  const [shown, setShown] = useState(false);
  const count = properties.length;

  if (count === 0) {
    return (
      <p className="mt-4 text-sm text-gray-600">
        Сейчас нет опубликованных объектов у этого риэлтора.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <Button
        type="button"
        variant="outline"
        aria-expanded={shown}
        onClick={() => setShown((v) => !v)}
      >
        {shown ? "Скрыть объекты" : `Показать объекты (${count})`}
      </Button>

      {shown ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <PropertyCard
              key={p.id}
              slug={p.slug}
              image={p.image}
              price={p.price}
              title={p.title}
              characteristics={p.characteristics}
              rooms={p.rooms}
              area={p.area}
              floor={p.floor}
              totalFloors={p.totalFloors}
              location={p.location}
              href={p.href}
              favoriteId={p.slug}
              isPriceReduced={p.isPriceReduced}
              compareId={p.slug}
              compareType={p.propertyType}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
