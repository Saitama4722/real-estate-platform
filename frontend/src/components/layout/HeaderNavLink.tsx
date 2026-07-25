"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * A single primary-nav entry with the design's `is-active` treatment (brand text
 * on a brand tint). Split out as a tiny client component so `header.tsx` can stay
 * a server component — only the link needs `usePathname`.
 */
export function HeaderNavLink({
  href,
  children,
  className,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  // Section match, so /catalog/<slug> keeps «Каталог» lit.
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[15px] font-medium leading-5 transition-colors duration-150",
        active
          ? "bg-brand-tint text-brand"
          : "text-fg-secondary hover:bg-gray-50 hover:text-fg",
        className,
      )}
    >
      {children}
    </Link>
  );
}
