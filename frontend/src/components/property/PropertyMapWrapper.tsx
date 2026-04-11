"use client";

import { lazy, Suspense } from "react";

const PropertyMapLazy = lazy(() =>
  import("./PropertyMap").then((mod) => ({ default: mod.PropertyMap })),
);

interface PropertyMapWrapperProps {
  latitude: number;
  longitude: number;
  showMap: boolean;
}

export function PropertyMapWrapper({
  latitude,
  longitude,
  showMap,
}: PropertyMapWrapperProps) {
  return (
    <Suspense
      fallback={
        <div
          className="mt-4 h-[320px] w-full animate-pulse rounded-xl border border-gray-200 bg-gray-100"
          aria-hidden
        />
      }
    >
      <PropertyMapLazy latitude={latitude} longitude={longitude} showMap={showMap} />
    </Suspense>
  );
}
