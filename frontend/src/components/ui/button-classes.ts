import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "inverse";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Button geometry and colour, shared by <Button> (a real <button>) and
 * <ButtonLink> (a next/link styled as a button).
 *
 * Lives in its own NON-"use client" module on purpose: server components such as
 * layout/header.tsx can call buttonClasses() on a plain <Link> and ship zero
 * client JS for a CTA.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ HOW CLASS CONFLICTS RESOLVE HERE — READ BEFORE ADDING A className OVERRIDE
 *
 * `cn()` is a plain join (NOT tailwind-merge), so an override passed via
 * className does NOT replace the class below — BOTH end up in the class list and
 * the winner is decided by Tailwind's own stylesheet order, not by the call site.
 *
 * Measured against this project's Tailwind 4.3.2 build:
 *     h-8 < h-9 < h-10 < h-11 < h-12      → the LARGER height wins
 *     px-3 < px-4 < px-6 < px-8           → the LARGER padding wins
 *     text-base < text-sm < text-xs       → the SMALLER text wins
 *
 * Consequence: passing className="h-8" to a size="md" button is a SILENT NO-OP
 * (h-10 sorts later and wins), while className="h-12" would quietly override the
 * size prop. Never express size through className — use the `size` prop. If a
 * genuinely new geometry is needed, add a size here rather than fighting it from
 * a call site.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const base = [
  "inline-flex items-center justify-center gap-2 whitespace-nowrap no-underline",
  "rounded-lg border border-transparent font-medium",
  "cursor-pointer select-none",
  "transition-[background-color,border-color,color,box-shadow] duration-150 ease-out",
  "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(26,95,224,0.25)]",
  "active:translate-y-px active:duration-100",
  "disabled:pointer-events-none disabled:bg-gray-100 disabled:border-transparent",
  "disabled:text-gray-400 disabled:cursor-not-allowed disabled:translate-y-0",
  "aria-disabled:pointer-events-none aria-disabled:bg-gray-100",
  "aria-disabled:text-gray-400 aria-disabled:cursor-not-allowed",
].join(" ");

/** Heights are the design's control ladder: 32 / 40 / 48, tuned to Golos Text. */
const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] leading-4 gap-1.5",
  md: "h-10 px-4 text-[15px] leading-5",
  lg: "h-12 px-[22px] text-base",
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover active:bg-brand-active",
  secondary:
    "bg-brand-tint text-blue-700 hover:bg-brand-tint-2 active:bg-blue-200",
  outline:
    "bg-surface-raised border-border-strong text-fg hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700",
  ghost: "bg-transparent text-fg-secondary hover:bg-gray-100 hover:text-fg",
  // Errors / destructive only. The ACCENT red (#DE2B37) is never a button —
  // see the red→carmine mapping note in globals.css.
  danger: "bg-danger text-white hover:bg-danger-hover",
  inverse: "bg-white text-blue-700 hover:bg-blue-50",
};

export interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonClassOptions = {}): string {
  return cn(
    base,
    sizeClasses[size],
    variantClasses[variant],
    fullWidth && "w-full",
    className,
  );
}
