"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * ReactNode rather than string so a label can contain a link (e.g. the
   * personal-data consent pointing at the policy). Plain strings still work.
   */
  label?: React.ReactNode;
  /**
   * Top-align the box with the first line instead of centring it. Use for any
   * label that wraps to more than one line — centring against a 2-3 line block
   * leaves the box floating in the middle of the text.
   *
   * ⚠ A prop rather than `className`, because `cn()` here is a naive join, NOT
   * tailwind-merge: passing `items-start` alongside the hardcoded `items-center`
   * would emit BOTH and let stylesheet order decide the winner.
   */
  alignTop?: boolean;
  /** Extra classes for the wrapping <label> (the `className` prop targets the input). */
  wrapperClassName?: string;
  /**
   * REPLACES the label text's default classes rather than adding to them —
   * `cn()` is a naive join, so merging a second `text-*`/colour would emit both
   * and let stylesheet order pick the winner. Swapping is deterministic.
   */
  labelClassName?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      label,
      id,
      alignTop,
      wrapperClassName,
      labelClassName,
      ...props
    },
    ref,
  ) => {
    return (
      <label
        htmlFor={id}
        className={cn(
          "inline-flex gap-2",
          alignTop ? "items-start" : "items-center",
          props.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          wrapperClassName,
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          id={id}
          className={cn(
            "h-4 w-4 rounded border-gray-300 text-blue-600",
            "focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
            "disabled:cursor-not-allowed",
            className,
          )}
          {...props}
        />
        {label && (
          <span className={labelClassName ?? "text-sm text-gray-700"}>
            {label}
          </span>
        )}
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";
