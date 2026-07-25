"use client";

import { memo, useId } from "react";
import Link from "next/link";
import { isPropertyImageUrl } from "@/lib/propertyMedia";
import { FavoriteHeartButton } from "@/components/favorites/FavoriteHeartButton";
import { CompareToggleButton } from "@/components/compare/CompareToggleButton";
import { PriceDropBadge } from "@/components/property/PriceDropBadge";
import { Icon, Icons } from "@/components/ui/icon";
import type { LucideIcon } from "lucide-react";
import type { ComparePropertyType } from "@/lib/compare";

interface PropertyCardProps {
  slug?: string;
  image: string;
  price: string;
  title: string;
  /**
   * Pre-joined spec string (e.g. "3 комн. • 45 м² • 8/8 этаж").
   * FALLBACK ONLY — used when the structured rooms/area/floor props below are
   * absent. Structured props render the iconed spec line the design requires.
   */
  characteristics?: string;
  location: string;
  href?: string;
  /**
   * When set, a favorite (heart) toggle is rendered over the card image using
   * this value as the stored identifier (the property slug). Omit to hide it.
   */
  favoriteId?: string;
  /** Show the «Цена снижена» badge next to the price (server-computed). */
  isPriceReduced?: boolean;
  /**
   * When set (with compareType), a compare toggle is rendered over the card
   * image. Uses this value (the property slug) as the compare identifier.
   */
  compareId?: string;
  /** Property type — required alongside compareId for the same-type constraint. */
  compareType?: ComparePropertyType;
  /* ---- Structured specs: drive the iconed spec line ---------------------- */
  /** Room count (apartments). */
  rooms?: number;
  /** Area in m² — total area for flats/commercial, plot area (сот.) for land. */
  area?: number;
  /** Floor the unit is on. Rendered only together with totalFloors. */
  floor?: number;
  /** Floors in the building. Rendered only together with floor. */
  totalFloors?: number;
}

/**
 * "45.00" → "45", "45.5" → "45,5". The API sends decimals as strings that the
 * mappers coerce with Number(), so trailing ".00" is common; a Russian decimal
 * comma is used for the rare fractional value.
 */
function formatSpecNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(2))).replace(".", ",");
}

interface SpecItem {
  icon: LucideIcon;
  text: string;
}

/**
 * The spec line is the catalogue's "unit of scanning" (load-bearing decision
 * #4: price → specs → address). Items are picked by WHICH DATA EXISTS rather
 * than by property type, so a land plot or commercial unit naturally collapses
 * to a single area item without a per-type branch.
 */
function buildSpecs({
  rooms,
  area,
  floor,
  totalFloors,
}: Pick<
  PropertyCardProps,
  "rooms" | "area" | "floor" | "totalFloors"
>): SpecItem[] {
  const specs: SpecItem[] = [];
  if (rooms != null) {
    specs.push({ icon: Icons.Rooms, text: `${rooms}-комн.` });
  }
  if (area != null && Number.isFinite(area) && area > 0) {
    specs.push({ icon: Icons.Area, text: `${formatSpecNumber(area)} м²` });
  }
  if (floor != null && totalFloors != null) {
    specs.push({ icon: Icons.Floor, text: `${floor}/${totalFloors} эт.` });
  }
  return specs;
}

function PropertyCardComponent({
  slug,
  image,
  price,
  title,
  characteristics,
  location,
  href,
  favoriteId,
  isPriceReduced,
  compareId,
  compareType,
  rooms,
  area,
  floor,
  totalFloors,
}: PropertyCardProps) {
  const targetHref = href ?? (slug ? `/catalog/${slug}` : "/catalog");
  const specs = buildSpecs({ rooms, area, floor, totalFloors });
  /* Unique per card — the overlay anchor borrows the hidden <h3> as its
     accessible name via aria-labelledby, so the id cannot be a constant. */
  const titleId = useId();

  return (
    /*
     * Card chrome: white surface on the warm page background, depth from a
     * SHADOW rather than a border (load-bearing decision #6 — switching to
     * borders is a different system). Hover is the design's card treatment:
     * shadow sm→md + 3px lift + photo ×1.04 at 250ms ease-out.
     *
     * `overflow-hidden` is safe here (per the ancestor-clipping checklist): the
     * only absolutely-positioned children are the heart/compare toggles, which
     * sit INSIDE the photo and are never meant to escape the card. It is also
     * what clips the photo's hover scale to the rounded corners.
     *
     * `motion-reduce:` neutralises the two MOVEMENTS (lift, photo scale) rather
     * than merely shortening them — the global reduced-motion block only zeroes
     * transition-duration, which would still apply the transform instantly.
     * Colour, shadow and focus rings are deliberately kept.
     *
     * ⚠ The transition list names `translate`, NOT `transform`. Tailwind v4
     * compiles `-translate-y-*` to the individual `translate` CSS property, so
     * `transition-[box-shadow,transform]` left the lift UNANIMATED — it applied
     * but snapped instantly, with nothing to indicate the miss. (v4's own
     * `transition-transform` utility expands to `transform, translate, scale,
     * rotate`, which is why the photo's scale below animates correctly.) If you
     * add another transformed hover state here, name its real property too.
     */
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-surface-raised shadow-sm transition-[box-shadow,translate] duration-[250ms] ease-out hover:-translate-y-[3px] hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      {/* Photo is 4:3 per the design system (was 16/10). */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-inset">
        {isPropertyImageUrl(image) ? (
          <div className="relative h-full w-full">
            <img
              src={image}
              alt=""
              className="h-full w-full object-cover transition-transform duration-[250ms] ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              loading="lazy"
              decoding="async"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
            />
            {/* Overlay to deter right-click "save image" / drag, without
                capturing clicks (pointer-events: none). */}
            <span
              aria-hidden="true"
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
              className="pointer-events-none absolute inset-0"
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-small text-fg-muted">
            {image}
          </div>
        )}
        {/* Opposite corners on purpose — compare top-LEFT, favourite top-RIGHT.
            Grouping them would crowd the photo; this is a settled decision, not
            the mockup's both-on-the-right layout. */}
        {/* z-20 keeps these ABOVE the whole-card overlay anchor (z-10) added at
            the end of this component, so they stay clickable. */}
        {compareId && compareType && (
          <CompareToggleButton
            compareId={compareId}
            compareType={compareType}
            className="absolute left-2 top-2 z-20"
          />
        )}
        {favoriteId && (
          <FavoriteHeartButton
            favoriteId={favoriteId}
            className="absolute right-2 top-2 z-20"
          />
        )}
      </div>

      {/* 14/16/16 padding, 6px between rows, per the kit's `.ctr-card__body`. */}
      <div className="flex flex-1 flex-col px-4 pt-3.5 pb-4">
        {/* Hierarchy is strict: price (largest) → specs → address. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-price tabular-price text-fg">{price}</p>
          {isPriceReduced && <PriceDropBadge />}
        </div>

        {/*
          * Visually hidden, deliberately still in the DOM.
          *
          * `title_generated` restates the spec line and the address verbatim
          * («1-комн. квартира, 45.00 м², Краснодар» above «1-комн. · 45 м² ·
          * 8/8 эт.» above «Краснодар, п. Северный»), down to a less consistent
          * "45.00 м²" next to the formatted "45 м²". The design's card is
          * price → specs → address with no title line, so it is hidden rather
          * than shown — but NOT deleted: it is the card's only heading, and the
          * CTA's accessible name is the non-descriptive «Открыть объект», so
          * removing it would leave screen-reader users with unlabelled cards.
          */}
        <h3 id={titleId} className="sr-only">
          {title}
        </h3>

        {specs.length > 0 ? (
          <ul className="mt-1.5 flex flex-wrap items-center gap-x-[14px] gap-y-1 text-small text-fg-secondary">
            {specs.map((spec) => (
              <li key={spec.text} className="inline-flex items-center gap-1.5">
                {/* neutral-400, a step lighter than the text — the kit dims spec
                    glyphs so the values read first. */}
                <Icon
                  icon={spec.icon}
                  size={16}
                  className="shrink-0 text-gray-400"
                />
                {spec.text}
              </li>
            ))}
          </ul>
        ) : (
          characteristics && (
            <p className="mt-1.5 text-small text-fg-secondary">
              {characteristics}
            </p>
          )
        )}

        <p className="mt-1.5 inline-flex items-start gap-1.5 text-[13px] leading-[18px] text-fg-muted">
          <Icon
            icon={Icons.Address}
            size={16}
            className="mt-px shrink-0 text-gray-400"
          />
          <span className="line-clamp-2">{location}</span>
        </p>
      </div>

      {/*
       * WHOLE-CARD LINK, as an absolutely-positioned overlay — the kit has no
       * «Открыть объект» button and makes the entire card one link.
       *
       * Deliberately NOT wrapping the card in an <a>: the card contains the
       * favourite and compare BUTTONS, and an anchor may not contain other
       * interactive elements. Nesting them would be invalid HTML and would break
       * both click handling and tab order. The overlay sits at z-10, under those
       * buttons (z-20), so they keep receiving their own clicks and focus.
       *
       * Rendered last so tab order is: compare → favourite → open listing.
       * Named by the visually-hidden <h3> above, so the link is not announced as
       * a bare URL.
       */}
      <Link
        href={targetHref}
        aria-labelledby={titleId}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      />
    </article>
  );
}

export const PropertyCard = memo(PropertyCardComponent);
