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

/** Фильтр «Все доступные / Свободные / Мои / Архив» — общий для заявок и заявок на продажу.
    «Архив» (личный, «Скрыть») — только у риэлтора. */
export function QueueScopeFilter({
  value,
  onChange,
  showArchive = false,
}: {
  value: CrmQueueScope;
  onChange: (v: CrmQueueScope) => void;
  showArchive?: boolean;
}) {
  return (
    <div role="group" aria-label="Какие заявки показать" className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {CRM_QUEUE_SCOPES.filter((s) => !s.realtorOnly || showArchive).map((s) => (
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

/**
 * Панель массовых действий над выбранными строками. Кнопки показываются по
 * роли: «Скрыть»/«Вернуть из архива» — риэлтор, «Удалить» — суперадмин/админ.
 * «Отметить все прочитанными» работает без выбора — по всему текущему фильтру.
 */
export function CrmBulkToolbar({
  selectedCount,
  busy,
  isRealtor,
  isStaff,
  inArchive,
  onMarkRead,
  onMarkAllRead,
  onHide,
  onUnhide,
  onDelete,
  onClear,
}: {
  selectedCount: number;
  busy: boolean;
  isRealtor: boolean;
  isStaff: boolean;
  inArchive: boolean;
  onMarkRead: () => void;
  onMarkAllRead: () => void;
  onHide: () => void;
  onUnhide: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const btn =
    "rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Действия с заявками">
      {selectedCount > 0 ? (
        <>
          <span className="text-xs font-medium text-slate-700">Выбрано: {selectedCount}</span>
          <button type="button" className={btn} disabled={busy} onClick={onMarkRead}>
            Отметить прочитанными
          </button>
          {isRealtor && !inArchive ? (
            <button type="button" className={btn} disabled={busy} onClick={onHide}>
              Скрыть
            </button>
          ) : null}
          {isRealtor && inArchive ? (
            <button type="button" className={btn} disabled={busy} onClick={onUnhide}>
              Вернуть из архива
            </button>
          ) : null}
          {isStaff ? (
            <button
              type="button"
              className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              disabled={busy}
              onClick={onDelete}
            >
              Удалить
            </button>
          ) : null}
          <button
            type="button"
            className="text-xs text-slate-500 underline-offset-2 hover:underline"
            onClick={onClear}
          >
            Снять выбор
          </button>
        </>
      ) : null}
      <button
        type="button"
        className={cn(btn, selectedCount > 0 && "ml-auto")}
        disabled={busy}
        onClick={onMarkAllRead}
      >
        Отметить все прочитанными
      </button>
    </div>
  );
}

/** Форма подтверждения массового удаления — ровно текст из ТЗ. */
export function confirmBulkDelete(n: number): boolean {
  const word = n % 10 === 1 && n % 100 !== 11 ? "заявку" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "заявки" : "заявок";
  return window.confirm(`Удалить ${n} ${word} без возможности восстановления?`);
}
