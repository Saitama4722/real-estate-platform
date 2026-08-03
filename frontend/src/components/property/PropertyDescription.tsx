"use client";

import { useState } from "react";
import { CatalogPropertyItem } from "@/components/catalog/types";
import { PropertySection } from "@/components/property/PropertySection";

interface PropertyDescriptionProps {
  property: CatalogPropertyItem;
}

const TYPE_HEADINGS: Record<string, string> = {
  apartment: "О квартире",
  house: "О доме",
  land: "Об участке",
  commercial: "О помещении",
};

/** Characters shown before the text is collapsed behind «Читать далее». */
const COLLAPSED_LENGTH = 300;

export function PropertyDescription({ property }: PropertyDescriptionProps) {
  const [expanded, setExpanded] = useState(false);

  if (!property.description) {
    return null;
  }

  const heading =
    (property.propertyType && TYPE_HEADINGS[property.propertyType]) ??
    "Об объекте";

  const description = property.description;
  const isLong = description.length > COLLAPSED_LENGTH;
  // Collapsed: first COLLAPSED_LENGTH characters + an ellipsis.
  const shownText =
    isLong && !expanded
      ? `${description.slice(0, COLLAPSED_LENGTH).trimEnd()}…`
      : description;

  return (
    <PropertySection
      title={heading}
      className="select-none"
      // Reference body copy: 15.5px / 1.68. `text-base leading-relaxed` (16 /
      // 1.625) was close but not it, and the difference shows over a paragraph.
      bodyClassName="[&_p]:text-[15.5px] [&_p]:leading-[1.68] [&_p]:text-fg-secondary"
      // Copy-blocking stays exactly as it was — this is a styling change only.
    >
      <div onCopy={(e) => e.preventDefault()}>

      {/* grid-rows 0fr→1fr animates the wrapper between zero and the natural
          height of the current text, giving a smooth expand/collapse. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          isLong && !expanded ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="mt-4 text-base leading-relaxed text-gray-700">
            {description}
          </p>
        </div>
      </div>

      {/* Collapsed preview (first 300 chars + …). Hidden once expanded so the
          full text above animates open in its place. */}
      {isLong && !expanded && (
        <p className="mt-4 text-base leading-relaxed text-gray-700">
          {shownText}
        </p>
      )}

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
          aria-expanded={expanded}
        >
          {expanded ? "Свернуть" : "Читать далее"}
        </button>
      )}
      </div>
    </PropertySection>
  );
}
