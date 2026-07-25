"use client";

import type { LucideIcon } from "lucide-react";
import { Container } from "@/components/layout/container";
import { HomepageInlineText } from "@/components/home/HomepageInlineText";
import { SectionHeader } from "@/components/home/SectionHeader";
import { Icon, Icons } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type {
  HomeCategory,
  HomePropertyType,
} from "@/components/home/HomeCatalogExplorer";

/**
 * The design system's category glyphs (readme §ICONOGRAPHY): building-2 /
 * house / land-plot / store. Keyed by `propertyType`, which every category
 * already carries for filtering — so there is no new field to keep in sync.
 */
const CATEGORY_ICONS: Record<HomePropertyType, LucideIcon> = {
  apartment: Icons.Apartment,
  house: Icons.House,
  land: Icons.Land,
  commercial: Icons.Commercial,
};

interface CategoriesSectionProps {
  categories: HomeCategory[];
  sectionTitle: string;
  /** id активной категории (`null` — фильтр «Все»/сброшен). */
  activeCategoryId: string | null;
  /** Выбор категории; `null` — сброс к «Все». */
  onSelectCategory: (id: string | null) => void;
}

/**
 * Card chrome shared by both states. Depth is a SHADOW, not a border (design
 * decision #6), matching PropertyCard so the two card families read as one
 * system on the same page.
 *
 * ⚠ The transition names `translate`, not `transform` — Tailwind v4 compiles
 * `-translate-y-*` to the individual `translate` property, so naming `transform`
 * leaves the lift applied but UNANIMATED. Same trap as in PropertyCard.
 */
const CARD_BASE =
  "rounded-xl bg-surface-raised p-4 text-left shadow-sm cursor-pointer md:p-6" +
  " transition-[box-shadow,translate,background-color,outline-color]" +
  // -2px here, NOT the -3px PropertyCard uses. The kit specifies a different
  // lift per card family (`.cat`/`.art` = 2px, `.ctr-card` = 3px).
  " duration-[250ms] ease-out hover:-translate-y-[2px] hover:shadow-md" +
  " focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(26,95,224,0.25)]" +
  " motion-reduce:transition-none motion-reduce:hover:translate-y-0";

export function CategoriesSection({
  categories,
  sectionTitle,
  activeCategoryId,
  onSelectCategory,
}: CategoriesSectionProps) {
  return (
    <section className="ctr-sec">
      <Container>
        {/* No "more" link: the kit gives Категории a bare heading. */}
        <SectionHeader>
          <HomepageInlineText
            blockKey="categories_section_title"
            value={sectionTitle}
            as="h2"
            /* Size/weight come from the base `h2` rule (24/30 → 28/36, 700). The
               old `text-2xl font-semibold` pinned it to 24px/600 on every
               screen, overriding the scale. */
            className="text-fg"
          />
        </SectionHeader>
        {/* `data-reveal-stagger` opts this grid's 4 cards into the 60ms-per-item
            entrance. Deliberately only here: the design wants the stagger on
            first-screen grids and NO per-card delay in the long catalogue. */}
        <div
          data-reveal-stagger
          className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5"
        >
          {categories.map((category) => {
            const isActive = activeCategoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelectCategory(category.id)}
                className={cn(
                  CARD_BASE,
                  // Active state is a ring + tint rather than a border, so
                  // selecting a card cannot change its size (a border would add
                  // 1px and nudge the grid).
                  isActive && "bg-brand-tint ring-2 ring-brand",
                )}
              >
                {/* 28px glyph in a 48px brand-tint plate, per the icon ladder.
                    Inverts to solid brand when the category is the active
                    filter, so the selection reads at a glance. */}
                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-150 ease-out md:h-12 md:w-12",
                    isActive
                      ? "bg-brand text-white"
                      : "bg-brand-tint text-brand",
                  )}
                >
                  <Icon icon={CATEGORY_ICONS[category.propertyType]} size={28} />
                </span>
                {/* 16/22 mobile → 17/24 desktop; the 17px step is the kit's own
                    `.cat b` value and is not on the shared type scale. */}
                <p className="mt-3 text-base leading-[22px] font-semibold text-fg md:mt-4 md:text-[17px] md:leading-6">
                  {category.label}
                </p>
                <p className="mt-1 text-[12px] leading-4 text-fg-muted md:text-[13px] md:leading-[18px]">
                  {category.description}
                </p>
              </button>
            );
          })}
        </div>
        {activeCategoryId !== null ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => onSelectCategory(null)}
              className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline"
            >
              Показать все
            </button>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
