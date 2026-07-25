"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { PriceDropBadge } from "@/components/property/PriceDropBadge";
import { isPropertyImageUrl } from "@/lib/propertyMedia";
import { formatPriceRub } from "@/lib/formatPrice";
import type { CatalogPropertyItem } from "@/components/catalog/types";
import {
  fetchPublicPropertyBySlug,
  mapPublicDetailToCatalogItem,
} from "@/lib/publicProperty";
import { useCompare } from "@/lib/compare";

/**
 * Client-only "Сравнение" page. Mirrors FavoritesView's fetch pattern:
 * localStorage stores only slugs, so we fetch each property's detail, cache it in
 * a ref, and render a side-by-side table (properties = columns, attributes =
 * rows). Removing a column just filters the rendered list — no refetch/reload.
 * Because selection is same-type-only, the row set is clean (no mixed types).
 */

type RowValue = { text: string; num?: number };

interface CompareRow {
  label: string;
  /** Compute the cell for one property; return null to omit if all are empty. */
  get: (p: CatalogPropertyItem) => RowValue | null;
  /** When true, the lowest numeric value across columns is highlighted. */
  highlightLowest?: boolean;
}

function priceNumber(price: string): number {
  return parseInt(price.replace(/\D/g, ""), 10) || 0;
}

function pricePerSqm(p: CatalogPropertyItem): number | null {
  const price = priceNumber(p.price);
  if (!price || !p.area || p.area <= 0) return null;
  // Land area is in "соток", not м² — a per-м² figure would be misleading.
  if (p.propertyType === "land") return null;
  return Math.round(price / p.area);
}

const AREA_UNIT = (p: CatalogPropertyItem) =>
  p.propertyType === "land" ? "соток" : "м²";

/** Row definitions, in display order. Rows with no data in ANY column are hidden. */
const ROWS: CompareRow[] = [
  {
    label: "Цена",
    highlightLowest: true,
    get: (p) => ({ text: p.price, num: priceNumber(p.price) }),
  },
  {
    label: "Цена за м²",
    highlightLowest: true,
    get: (p) => {
      const v = pricePerSqm(p);
      return v ? { text: formatPriceRub(v), num: v } : null;
    },
  },
  {
    label: "Комнат",
    get: (p) => (p.rooms != null ? { text: String(p.rooms), num: p.rooms } : null),
  },
  {
    label: "Площадь",
    get: (p) =>
      p.area != null ? { text: `${p.area} ${AREA_UNIT(p)}`, num: p.area } : null,
  },
  {
    label: "Этаж",
    get: (p) =>
      p.floor != null
        ? { text: p.totalFloors ? `${p.floor}/${p.totalFloors}` : String(p.floor) }
        : null,
  },
  {
    label: "Район",
    get: (p) => (p.district ? { text: p.district } : null),
  },
  {
    label: "Расположение",
    get: (p) => (p.location ? { text: p.location } : null),
  },
  { label: "Ремонт", get: (p) => (p.details?.renovation ? { text: p.details.renovation } : null) },
  { label: "Материал", get: (p) => (p.details?.material ? { text: p.details.material } : null) },
  {
    label: "Площадь кухни",
    get: (p) => (p.details?.kitchenArea ? { text: p.details.kitchenArea } : null),
  },
  {
    label: "Высота потолков",
    get: (p) => (p.details?.ceilingHeight ? { text: p.details.ceilingHeight } : null),
  },
];

export function CompareView() {
  const { slugs, ready, removeCompare } = useCompare();
  const [items, setItems] = useState<CatalogPropertyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef<Map<string, CatalogPropertyItem | null>>(new Map());

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const cache = cacheRef.current;
      const missing = slugs.filter((s) => !cache.has(s));
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
        for (const { slug, item } of fetched) cache.set(slug, item);
      }
      if (cancelled) return;
      const resolved = slugs
        .map((s) => cache.get(s) ?? null)
        .filter((x): x is CatalogPropertyItem => x !== null);
      setItems(resolved);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slugs, ready]);

  // Only keep rows that have at least one non-empty cell across the columns.
  const visibleRows = useMemo(
    () => ROWS.filter((row) => items.some((p) => row.get(p) !== null)),
    [items],
  );

  // Per-row lowest numeric value (for highlighting).
  const lowestByRow = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of visibleRows) {
      if (!row.highlightLowest) continue;
      const nums = items
        .map((p) => row.get(p)?.num)
        .filter((n): n is number => typeof n === "number");
      if (nums.length > 1) map.set(row.label, Math.min(...nums));
    }
    return map;
  }, [visibleRows, items]);

  if (ready && !loading && items.length < 2) {
    return (
      <Container className="py-8 md:py-12">
        <h1 className="text-2xl font-semibold text-gray-900">Сравнение объектов</h1>
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
          <p className="text-base text-gray-700">
            Выберите минимум 2 объекта одного типа для сравнения.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Отмечайте объекты значком сравнения на карточках в каталоге.
          </p>
          <Link
            href="/catalog"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          >
            Перейти в каталог
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container size="wide" className="py-8 md:py-12">
      <h1 className="text-2xl font-semibold text-gray-900">Сравнение объектов</h1>

      {!ready || loading ? (
        <div className="mt-6 h-96 animate-pulse rounded-xl border border-gray-200 bg-gray-100" />
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                {/* Empty top-left corner cell over the row-label column. */}
                <th className="w-40 border-b border-gray-200 p-3 text-left align-bottom" />
                {items.map((p) => (
                  <th
                    key={p.id}
                    className="border-b border-gray-200 p-3 text-left align-top"
                  >
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => p.slug && removeCompare(p.slug)}
                        aria-label="Убрать из сравнения"
                        title="Убрать из сравнения"
                        className="absolute right-0 top-0 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow-sm ring-1 ring-gray-200 transition-colors hover:text-gray-900"
                      >
                        ✕
                      </button>
                      <Link href={p.href} className="block">
                        <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-gray-200">
                          {isPropertyImageUrl(p.image) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.image}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-gray-500">
                              {p.image}
                            </div>
                          )}
                        </div>
                        <p className="mt-2 line-clamp-2 font-medium text-gray-900">
                          {p.title}
                        </p>
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const lowest = lowestByRow.get(row.label);
                return (
                  <tr key={row.label} className="align-top">
                    <th
                      scope="row"
                      className="border-b border-gray-100 p-3 text-left font-normal text-gray-500"
                    >
                      {row.label}
                    </th>
                    {items.map((p) => {
                      const cell = row.get(p);
                      const isLowest =
                        lowest != null && cell?.num != null && cell.num === lowest;
                      return (
                        <td
                          key={p.id}
                          className="border-b border-gray-100 p-3 text-gray-900"
                        >
                          {cell ? (
                            <span
                              className={
                                isLowest ? "font-semibold text-green-700" : undefined
                              }
                            >
                              {cell.text}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                          {row.label === "Цена" && p.isPriceReduced && (
                            <span className="ml-2 align-middle">
                              <PriceDropBadge />
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {/* Actions row: link to each property's detail page. */}
              <tr>
                <th className="p-3" />
                {items.map((p) => (
                  <td key={p.id} className="p-3">
                    <Link
                      href={p.href}
                      className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
                    >
                      Открыть объект
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
