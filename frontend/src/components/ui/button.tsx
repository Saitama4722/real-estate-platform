"use client";

import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/button-classes";

export type { ButtonSize, ButtonVariant };

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Lucide glyph rendered before the label, sized to match the button. */
  icon?: LucideIcon;
  /** Lucide glyph rendered after the label (e.g. a chevron). */
  iconRight?: LucideIcon;
}

/**
 * Shared button. See button-classes.ts for the variant/size matrix AND for the
 * (counter-intuitive) rules on how a className override actually resolves —
 * never express height, padding or text size through className.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      icon,
      iconRight,
      className,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const glyphSize = size === "sm" ? 16 : 20;
    return (
      <button
        ref={ref}
        type={type}
        className={buttonClasses({ variant, size, fullWidth, className })}
        {...props}
      >
        {icon && <Icon icon={icon} size={glyphSize} className="shrink-0" />}
        {children}
        {iconRight && (
          <Icon icon={iconRight} size={glyphSize} className="shrink-0" />
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
