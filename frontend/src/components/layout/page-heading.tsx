import { cn } from "@/lib/utils";

export interface PageHeadingProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeading({
  title,
  subtitle,
  children,
  className,
}: PageHeadingProps) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 py-6", className)}
    >
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-gray-500">{subtitle}</p>}
      </div>
      {children && (
        <div className="flex items-center gap-2 shrink-0">{children}</div>
      )}
    </div>
  );
}
