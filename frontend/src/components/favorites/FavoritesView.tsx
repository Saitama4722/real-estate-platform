"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { PropertyCard } from "@/components/home/PropertyCard";
import type { CatalogPropertyItem } from "@/components/catalog/types";
import {
  fetchPublicPropertyBySlug,
  mapPublicDetailToCatalogItem,
} from "@/lib/publicProperty";
import { useFavorites } from "@/lib/favorites";

/**
 * Client-only "Избранное" page. localStorage stores only slugs, so we fetch the
 * full property detail for each favorited slug (there is no batch-by-id API) and
 * map it to the shared CatalogPropertyItem shape the PropertyCard expects.
 *
 * Fetched items are cached in a ref so toggling a heart (removal) just filters
 * the rendered list — no refetch, no reload. New favorites added elsewhere and
 * navigated back to are fetched on demand.
 */
export function FavoritesView() {
  const { favorites, ready } = useFavorites();
  const [items, setItems] = useState<CatalogPropertyItem[]>([]);
  const [loading, setLoading] = useState(true);
  // slug -> resolved catalog item (or null when the slug 404s / is unavailable).
  const cacheRef = useRef<Map<string, CatalogPropertyItem | null>>(new Map());

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const cache = cacheRef.current;

      // Fetch only slugs we haven't resolved yet.
      const missing = favorites.filter((slug) => !cache.has(slug));
      if (missing.length > 0) {
        const fetched = await Promise.all(
          missing.map(async (slug) => {
            const detail = await fetchPublicPropertyBySlug(slug);
            return {
              slug,
              item: detail ? mapPublicDetailToCatalogItem(detail, slug) : null,
            };
          }),
        );
        if (cancelled) return;
        for (const { slug, item } of fetched) {
          cache.set(slug, item);
        }
      }

      if (cancelled) return;
      // Preserve favorites order (newest first); drop slugs that failed to load.
      const resolved = favorites
        .map((slug) => cache.get(slug) ?? null)
        .filter((x): x is CatalogPropertyItem => x !== null);
      setItems(resolved);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [favorites, ready]);

  return (
    <Container className="py-8 md:py-12">
      <h1 className="text-2xl font-semibold text-gray-900">Избранное</h1>

      {!ready || loading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: Math.min(favorites.length || 3, 6) }).map((_, i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-xl border border-gray-200 bg-gray-100"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
          <p className="text-base text-gray-700">
            В избранном пока ничего нет.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Нажимайте на «сердечко» на карточках объектов, чтобы сохранить их здесь.
          </p>
          <Link
            href="/catalog"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          >
            Перейти в каталог
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((property) => (
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
      )}
    </Container>
  );
}
