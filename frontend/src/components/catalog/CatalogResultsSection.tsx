"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { CatalogControls } from "@/components/catalog/CatalogControls";
import { CatalogPropertyItem } from "@/components/catalog/types";
import { PropertyCard } from "@/components/home/PropertyCard";
import { sortCatalogProperties } from "@/lib/sortCatalogProperties";
import { hasCatalogItemMapCoords } from "@/lib/mapCoordinates";

// Leaflet/react-leaflet touch `window` at module-eval time, so this map must be
// client-only — `next/dynamic({ ssr: false })`, not `React.lazy` (which still
// runs on the server and throws "window is not defined").
const CatalogMapLazy = dynamic(
  () => import("@/components/catalog/CatalogMap").then((mod) => ({ default: mod.CatalogMap })),
  { ssr: false },
);

const PAGE_SIZE = 12;

interface CatalogResultsSectionProps {
  properties: CatalogPropertyItem[];
  initialMapView?: boolean;
}

export function CatalogResultsSection({
  properties,
  initialMapView = false,
}: CatalogResultsSectionProps) {
  const [viewMode, setViewMode] = useState<"list" | "map">(
    initialMapView ? "map" : "list",
  );
  const [sortValue, setSortValue] = useState("new");
  const [currentPage, setCurrentPage] = useState(1);

  const sorted = useMemo(
    () => sortCatalogProperties(properties, sortValue),
    [properties, sortValue],
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [sortValue, properties]);

  useEffect(() => {
    setViewMode(initialMapView ? "map" : "list");
  }, [initialMapView]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const mapItems = useMemo(() => sorted.filter(hasCatalogItemMapCoords), [sorted]);

  const pageSlice = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, currentPage]);

  return (
    <section className="mt-8" aria-label="Список объявлений">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold text-gray-900">Объявления</h2>
        <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
          <Button
            size="sm"
            variant={viewMode === "list" ? "primary" : "ghost"}
            onClick={() => setViewMode("list")}
          >
            Списком
          </Button>
          <Button
            size="sm"
            variant={viewMode === "map" ? "primary" : "ghost"}
            onClick={() => setViewMode("map")}
          >
            На карте
          </Button>
        </div>
      </div>

      {viewMode === "list" ? (
        <>
          <CatalogControls
            totalResults={sorted.length}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            sortValue={sortValue}
            onSortChange={setSortValue}
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pageSlice.map((property) => (
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
        </>
      ) : mapItems.length === 0 ? (
        <div className="mt-6 h-64 rounded-xl border border-dashed border-gray-300 bg-gray-50 md:h-80">
          <div className="flex h-full items-center justify-center px-4 text-center text-base text-gray-500">
            Нет объектов с координатами для отображения на карте
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <Suspense
            fallback={
              <div className="h-[440px] w-full animate-pulse rounded-xl border border-gray-200 bg-gray-100" />
            }
          >
            <CatalogMapLazy properties={mapItems} />
          </Suspense>
        </div>
      )}
    </section>
  );
}
