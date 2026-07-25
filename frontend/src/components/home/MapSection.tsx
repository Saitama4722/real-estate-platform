"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Container } from "@/components/layout/container";
import type { CatalogPropertyItem } from "@/components/catalog/types";
import { hasCatalogItemMapCoords } from "@/lib/mapCoordinates";
import { HomepageInlineText } from "@/components/home/HomepageInlineText";
import { SectionHeader } from "@/components/home/SectionHeader";

// Leaflet/react-leaflet touch `window` at module-eval time, so this map must be
// client-only — `next/dynamic({ ssr: false })`, not `React.lazy` (which still
// runs on the server and throws "window is not defined").
const CatalogMapLazy = dynamic(
  () => import("@/components/catalog/CatalogMap").then((mod) => ({ default: mod.CatalogMap })),
  { ssr: false },
);

interface MapSectionProps {
  properties: CatalogPropertyItem[];
  sectionTitle: string;
  emptyMessage: string;
}

export function MapSection({ properties, sectionTitle, emptyMessage }: MapSectionProps) {
  const withCoords = properties.filter(hasCatalogItemMapCoords);

  return (
    <section id="home-map" className="ctr-sec">
      <Container>
        <SectionHeader moreHref="/catalog?view=map" moreLabel="Открыть карту">
          <HomepageInlineText
            blockKey="map_section_title"
            value={sectionTitle}
            as="h2"
            /* Size/weight from the base `h2` rule — see CategoriesSection. This
               was still on the old `text-2xl font-semibold` override. */
            className="text-fg"
          />
        </SectionHeader>
        {/*
         * MAP SHELL ONLY at this stage: height 300 → 440 and radius-lg, matching
         * the kit's `.mapbox`. The kit also shows custom white zoom controls, a
         * Карта/Список segmented toggle and price-pill markers — those are
         * DEFERRED to the map stage on purpose, because they need the
         * viewport-sync behaviour and a marker data contract that do not exist
         * yet. Do not add them here piecemeal.
         */}
        {withCoords.length === 0 ? (
          <div className="h-[300px] rounded-2xl border border-dashed border-border-strong bg-surface-inset md:h-[440px]">
            <div className="flex h-full items-center justify-center px-4 text-center">
              <HomepageInlineText
                blockKey="map_empty_message"
                value={emptyMessage}
                as="span"
                className="text-body text-fg-muted"
              />
            </div>
          </div>
        ) : (
          <div className="h-[300px] overflow-hidden rounded-2xl shadow-sm md:h-[440px]">
            <Suspense
              fallback={
                <div className="h-full w-full animate-pulse bg-surface-inset" />
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
