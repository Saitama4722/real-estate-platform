import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/button-classes";

export interface ButtonLinkProps
  extends Omit<React.ComponentProps<typeof Link>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  className?: string;
}

/**
 * A next/link that looks exactly like <Button>.
 *
 * This exists so navigational CTAs stop being hand-rolled: the audit found the
 * same primary-button styling copy-pasted in three places (the header's inline
 * `bg-blue-600` Link, PropertyCard's PRIMARY_LINK_CLASS, and the real Button),
 * which was already drifting. Anything that NAVIGATES uses this; anything that
 * performs an ACTION uses <Button>.
 *
 * Not a client component — a server component can render it with no client JS.
 */
export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth = false,
  icon,
  iconRight,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  const glyphSize = size === "sm" ? 16 : 20;
  return (
    <Link
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {icon && <Icon icon={icon} size={glyphSize} className="shrink-0" />}
      {children}
      {iconRight && (
        <Icon icon={iconRight} size={glyphSize} className="shrink-0" />
      )}
    </Link>
  );
}
