import { Droplets, Flame, Waves, Zap, type LucideIcon } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { PropertySection } from "@/components/property/PropertySection";
import {
  UTILITY_LABELS,
  type CharacteristicRow,
  type UtilityKey,
} from "@/lib/propertyCharacteristics";

/**
 * «Характеристики»: the rows come ready from `buildCharacteristicRows`
 * (`lib/propertyCharacteristics.ts`, one map per property type that mirrors the
 * CRM form). This component only draws them: it decides nothing about WHAT is a
 * characteristic.
 *
 * ⚠ No location here. District, city, microdistrict, complex and address are the
 * header line (`lib/propertyLocation.ts`); a «Район» row below it was the
 * duplicate the owner reported. Floors are here and nowhere else on the page.
 */
const UTILITY_ICON: Record<UtilityKey, LucideIcon> = {
  gas: Flame,
  water: Droplets,
  sewerage: Waves,
  electricity: Zap,
};

export function PropertyCharacteristics({ rows }: { rows: CharacteristicRow[] }) {
  if (rows.length === 0) return null;

  return (
    <PropertySection title="Характеристики" bodyClassName="-mb-3">
      {/* Two columns from md up, one below. The list is built from whatever the
          listing actually has (2 rows for a bare plot, 10+ for a full house), so
          nothing here assumes a row count. Long values wrap inside their cell
          (`min-w-0 break-words`) instead of pushing the page sideways. */}
      <div className="grid md:grid-cols-2 md:gap-x-11">
        {rows.map((row) =>
          row.utilities ? (
            <div
              key={row.key}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border py-3 md:col-span-2"
            >
              <span className="text-sm text-fg-muted md:text-[14.5px]">{row.label}</span>
              <ul className="flex min-w-0 flex-wrap gap-1.5" aria-label={row.label}>
                {row.utilities.map((u) => (
                  <li
                    key={u}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-2.5 py-1 text-[13px] font-medium text-brand"
                  >
                    <Icon icon={UTILITY_ICON[u]} className="size-3.5" />
                    {UTILITY_LABELS[u]}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div key={row.key} className="flex items-baseline gap-2 border-b border-border py-3">
              <span className="shrink-0 text-sm text-fg-muted md:text-[14.5px]">{row.label}</span>
              {/* The leader: a flexible baseline rule between label and value.
                  -translate-y-[3px] drops it off the text baseline onto the
                  optical line the dots should sit on. */}
              <span
                aria-hidden="true"
                className="min-w-4 flex-1 -translate-y-[3px] border-b border-dotted border-border-strong"
              />
              <span className="min-w-0 max-w-[60%] break-words text-right text-sm font-semibold text-fg md:text-[14.5px]">
                {row.value}
              </span>
            </div>
          ),
        )}
      </div>
    </PropertySection>
  );
}
