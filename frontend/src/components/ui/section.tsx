import { cn } from "@/lib/utils";

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function Section({
  title,
  subtitle,
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <section className={cn("py-10", className)} {...props}>
      <div className="mx-auto max-w-6xl px-4">
        {(title || subtitle) && (
          <div className="mb-6">
            {title && (
              <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
