"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

// Leaflet/react-leaflet touch `window` at module-eval time, so this map must be
// client-only — `next/dynamic({ ssr: false })`, not `React.lazy` (which still
// runs on the server and throws "window is not defined").
const PropertyMapLazy = dynamic(
  () => import("./PropertyMap").then((mod) => ({ default: mod.PropertyMap })),
  { ssr: false },
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
