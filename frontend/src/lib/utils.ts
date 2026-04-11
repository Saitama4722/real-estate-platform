/**
 * Minimal class-name helper.
 * Filters falsy values and joins the rest with a space.
 * Usage: cn("base", isActive && "active", className)
 */
export function cn(
  ...classes: (string | undefined | null | false)[]
): string {
  return classes.filter(Boolean).join(" ");
}
