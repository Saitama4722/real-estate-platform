"use client";

import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";

interface CatalogControlsProps {
  totalResults: number;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  sortValue: string;
  onSortChange: (value: string) => void;
}

export function CatalogControls({
  totalResults,
  totalPages,
  currentPage,
  onPageChange,
  sortValue,
  onSortChange,
}: CatalogControlsProps) {
  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">Найдено объявлений: {totalResults}</p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Сортировка:</span>
          <Select
            aria-label="Сортировка объявлений"
            value={sortValue}
            onChange={(event) => onSortChange(event.target.value)}
            className="h-10 min-w-52"
          >
            <option value="new">Сначала новые</option>
            <option value="price_asc">Сначала дешевле</option>
            <option value="price_desc">Сначала дороже</option>
            <option value="area_desc">По площади</option>
          </Select>
        </div>
      </div>

      {totalPages > 1 ? (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          className="mt-5 justify-center"
        />
      ) : null}
    </div>
  );
}
