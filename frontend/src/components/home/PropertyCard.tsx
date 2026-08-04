"use client";

import { memo, useId } from "react";
import Link from "next/link";
import { isPropertyImageUrl } from "@/lib/propertyMedia";
import { FavoriteHeartButton } from "@/components/favorites/FavoriteHeartButton";
import { CompareToggleButton } from "@/components/compare/CompareToggleButton";
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
   * Published within the last 7 days (server-derived `is_new`). Shows the
   * «Новый объект» badge — but only when `isPriceReduced` is false; see the
   * single-badge-slot rule at the render site.
   */
  isNew?: boolean;
  /**
   * Optional pre-formatted «12 300 ₽/м²», right-aligned in the price row.
   * Additive (catalog cards pass it); existing call sites are unaffected.
   */
  pricePerM2?: string;
  /**
   * Formatted previous price, struck through beside the current one. The
   * mapper emits it ONLY when it is strictly higher than the current price,
   * so this component never has to judge whether a strike is warranted.
   */
  oldPrice?: string;
  /** «Новостройка» / «Вторичка» — photo badge, bottom-left. */
  marketLabel?: string;
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
  isNew,
  pricePerM2,
  oldPrice,
  marketLabel,
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
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-surface-raised shadow-sm ring-1 ring-gray-900/5 transition-[box-shadow,translate] duration-[250ms] ease-out hover:-translate-y-[3px] hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
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
        {/* «Цена снижена» ON THE PHOTO, top-left, per the catalog mockup.
            This REVERSES the earlier beside-the-price placement and the old
            opposite-corners layout (product decision, 2026-08-04): both
            action buttons now group top-RIGHT (heart, then compare — the
            mockup's order), freeing the top-left corner for the badge. */}
        {/*
          * ONE badge slot, and «Цена снижена» wins it.
          *
          * The kit's `.ctr-card__badges` is a flex row that could hold both,
          * but the other three corners are spoken for (top-right = heart +
          * compare, bottom-left = market), so a second badge here would be a
          * fourth overlay on one photo. Price-drop takes precedence because
          * it is the stronger buying signal and the only one not conveyed
          * elsewhere — recency is already carried by the default «Сначала
          * новые» sort and the card's position in the list. The overlap is
          * also rare and self-contradictory: a listing published under 7 days
          * ago whose price has ALREADY fallen below its peak.
          *
          * Geometry is the catalog mockup's badge box; only the fill differs,
          * which is exactly how the kit separates its two variants
          * (`.ctr-badge--accent` vs `--primary` share every box metric).
          */}
        {isPriceReduced ? (
          <span className="absolute left-3 top-3 z-20 flex h-6 items-center rounded-md bg-accent px-2.5 text-[11px] font-semibold tracking-wide text-white">
            Цена снижена
          </span>
        ) : (
          isNew && (
            <span className="absolute left-3 top-3 z-20 flex h-6 items-center rounded-md bg-brand px-2.5 text-[11px] font-semibold tracking-wide text-white">
              Новый объект
            </span>
          )
        )}
        {/* Market badge, photo bottom-left (mockup): navy at 70% so it reads
            over any photo, 11px/500 white. Rendered only for the two real
            markets — `other`/empty deliberately show nothing. */}
        {marketLabel && (
          <span className="absolute bottom-3 left-3 z-20 flex h-6 items-center rounded-md bg-surface-dark/70 px-2 text-[11px] font-medium text-white">
            {marketLabel}
          </span>
        )}
        {/* z-20 keeps the controls ABOVE the whole-card overlay anchor (z-10)
            added at the end of this component, so they stay clickable. */}
        {(favoriteId || (compareId && compareType)) && (
          <div className="absolute right-2.5 top-2.5 z-20 flex gap-1.5">
            {favoriteId && <FavoriteHeartButton favoriteId={favoriteId} />}
            {compareId && compareType && (
              <CompareToggleButton
                compareId={compareId}
                compareType={compareType}
                className="relative"
              />
            )}
          </div>
        )}
      </div>

      {/* 16px padding, 8px between rows — the catalog mockup's card body
          (p-4 / gap-2), which supersedes the kit's earlier 14/16/16 + 6px. */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Hierarchy is strict: price (largest) → specs → address. */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-price tabular-price text-fg">{price}</p>
          {/* Previous price. The mockup's slate-400 measures ~2.3:1 on white —
              below WCAG AA for text — so this uses the design system's own
              muted token (4.9:1) at the mockup's 13px/line-through. Same
              visual role, accessible. */}
          {oldPrice && (
            <span className="tabular-price text-[13px] text-fg-muted line-through">
              {oldPrice}
            </span>
          )}
          {pricePerM2 && (
            <span className="ml-auto text-caption tabular-price text-fg-muted">
              {pricePerM2}
            </span>
          )}
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
          <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] font-medium text-gray-700">
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
            <p className="text-[13px] font-medium text-gray-700">
              {characteristics}
            </p>
          )
        )}

        <p className="inline-flex items-start gap-1.5 text-[13px] leading-[18px] text-fg-muted">
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
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      />
    </article>
  );
}

export const PropertyCard = memo(PropertyCardComponent);
