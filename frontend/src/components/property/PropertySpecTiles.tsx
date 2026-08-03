import { Building2, DoorOpen, MapPinned, Scan } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import type { CatalogPropertyItem } from "@/components/catalog/types";

/**
 * Summary strip under the gallery: the handful of numbers a buyer scans first.
 *
 * ⚠ NOT a fixed four. Every tile is conditional, because the set genuinely
 * varies by type — a land plot has no rooms and no floor, and some commercial
 * listings carry neither. The grid is `auto-fit` so 1, 2, 3 or 4 tiles all fill
 * the row evenly instead of leaving a hole where a tile would have been, and
 * the whole strip disappears when a listing has none of them.
 *
 * The 1px gap over a border-coloured background is what draws the hairlines
 * between tiles — cheaper than per-tile borders that double up at the seams.
 */
export function PropertySpecTiles({
  property,
}: {
  property: CatalogPropertyItem;
}) {
  const isLand = property.propertyType === "land";

  const tiles: { icon: typeof Scan; value: string; label: string }[] = [];

  if (property.rooms) {
    tiles.push({
      icon: DoorOpen,
      value: String(property.rooms),
      label: property.rooms === 1 ? "комната" : "комнаты",
    });
  }
  if (property.area) {
    tiles.push({
      icon: Scan,
      value: isLand ? `${property.area} сот.` : `${property.area} м²`,
      label: isLand ? "площадь участка" : "общая площадь",
    });
  }
  if (property.floor) {
    tiles.push({
      icon: Building2,
      value: property.totalFloors
        ? `${property.floor} / ${property.totalFloors}`
        : String(property.floor),
      label: "этаж",
    });
  }
  if (property.district) {
    tiles.push({ icon: MapPinned, value: property.district, label: "район" });
  }

  if (tiles.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border shadow-sm md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex items-center gap-3 bg-surface-raised px-4 py-3.5 md:flex-col md:items-start md:gap-2.5 md:px-[18px] md:py-4"
        >
          <Icon icon={tile.icon} className="size-[18px] shrink-0 text-brand md:size-[19px]" />
          <div className="min-w-0">
            <div className="truncate text-base font-bold tracking-tight text-fg md:text-[19px]">
              {tile.value}
            </div>
            <div className="mt-px text-[11.5px] text-fg-muted md:text-[12.5px]">
              {tile.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
