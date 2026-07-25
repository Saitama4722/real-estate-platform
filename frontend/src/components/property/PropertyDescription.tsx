"use client";

import { useState } from "react";
import { CatalogPropertyItem } from "@/components/catalog/types";

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
    <div
      className="mt-6 select-none"
      onCopy={(e) => e.preventDefault()}
    >
      <h2 className="text-xl font-semibold text-gray-900">{heading}</h2>

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
  );
}
