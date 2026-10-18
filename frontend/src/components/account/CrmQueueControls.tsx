"use client";

import { CRM_QUEUE_SCOPES, type CrmQueueScope } from "@/lib/crmQueue";
import { cn } from "@/lib/utils";

/** «Свободная» — заявка без ответственного, её может взять любой риэлтор. */
export function FreeBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200",
        className,
      )}
    >
      Свободная
    </span>
  );
}

/** Фильтр «Все доступные / Свободные / Мои» — общий для заявок и заявок на продажу. */
export function QueueScopeFilter({
  value,
  onChange,
}: {
  value: CrmQueueScope;
  onChange: (v: CrmQueueScope) => void;
}) {
  return (
    <div role="group" aria-label="Какие заявки показать" className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {CRM_QUEUE_SCOPES.map((s) => (
        <button
          key={s.value || "all"}
          type="button"
          aria-pressed={value === s.value}
          onClick={() => onChange(s.value)}
          className={cn(
            "rounded-md px-3 py-1 text-sm transition-colors",
            value === s.value
              ? "bg-white font-medium text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
