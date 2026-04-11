"use client";

import { lazy, Suspense } from "react";
import { Container } from "@/components/layout/container";
import type { CatalogPropertyItem } from "@/components/catalog/types";
import { hasCatalogItemMapCoords } from "@/lib/mapCoordinates";

const CatalogMapLazy = lazy(() =>
  import("@/components/catalog/CatalogMap").then((mod) => ({ default: mod.CatalogMap })),
);

interface MapSectionProps {
  properties: CatalogPropertyItem[];
}

export function MapSection({ properties }: MapSectionProps) {
  const withCoords = properties.filter(hasCatalogItemMapCoords);

  return (
    <section id="home-map" className="py-10 md:py-12">
      <Container>
        <h2 className="text-2xl font-semibold text-gray-900">Объекты на карте</h2>
        {withCoords.length === 0 ? (
          <div className="mt-5 h-64 rounded-xl border border-dashed border-gray-300 bg-gray-50 md:mt-6 md:h-80">
            <div className="flex h-full items-center justify-center px-4 text-center text-base text-gray-500">
              Нет объектов с координатами для отображения на карте
            </div>
          </div>
        ) : (
          <div className="mt-5 md:mt-6">
            <Suspense
              fallback={
                <div className="h-[440px] w-full animate-pulse rounded-xl border border-gray-200 bg-gray-100" />
              }
            >
              <CatalogMapLazy properties={withCoords} />
            </Suspense>
          </div>
        )}
      </Container>
    </section>
  );
}
