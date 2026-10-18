"use client";

/**
 * Колокольчик уведомлений CRM в шапке — ТОЛЬКО для риэлторов.
 *
 * Число берётся из того же единственного опроса, что и счётчики бокового меню
 * (`lib/crmUnreadCounts.ts`, 30 секунд, пауза на скрытой вкладке); звук тоже
 * играет только там. Здесь — лишь отрисовка и выпадающий список, который
 * грузится по клику (`GET /api/crm/notifications/`, последние 24 часа).
 *
 * Суперадмин и администратор колокольчика не видят: они не участники процесса
 * (решение владельца 2026-10-18). Решает это вызывающий —
 * `HeaderAccountControls` рендерит колокольчик только для `role=realtor`.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Icons } from "@/components/ui/icon";
import { fetchWithCrmAuthRetry } from "@/lib/crmAuth";
import {
  applyCrmReadOptimistic,
  formatUnreadBadge,
  useCrmUnreadCounts,
} from "@/lib/crmUnreadCounts";
import { cn } from "@/lib/utils";

type BellItem = {
  id: number;
  type: "new_lead" | "new_sale_request" | "assigned" | string;
  type_label: string;
  title: string;
  context: string;
  target: { kind: "lead" | "sale_request"; id: number };
  is_read: boolean;
  created_at: string;
};

/** Куда ведёт клик. У лида нет своей страницы — его карточка раскрывается в
    таблице по `?lead=`; у заявки на продажу страница есть. */
export function crmNotificationHref(target: BellItem["target"]): string {
  return target.kind === "lead"
    ? `/account/inquiries?lead=${target.id}`
    : `/account/sale-requests/${target.id}`;
}

function relativeTime(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  return `${h} ч назад`;
}

function parseItems(raw: unknown): BellItem[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as { results?: unknown }).results;
  return Array.isArray(list) ? (list as BellItem[]) : [];
}

export function HeaderNotificationsBell() {
  const router = useRouter();
  const { counts } = useCrmUnreadCounts();
  const unread = counts?.notifications ?? 0;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BellItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const loadItems = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetchWithCrmAuthRetry("/api/crm/notifications/");
      if (!res.ok) throw new Error(String(res.status));
      setItems(parseItems(await res.json()));
      setNow(Date.now());
    } catch {
      /* Не «пусто», а «не удалось»: провал загрузки не рисуется как
         «уведомлений нет» (CLAUDE.md, «A failed lookup is not an empty result»). */
      setFailed(true);
    }
  }, []);

  // Список перечитываем при каждом открытии и когда меняется число непрочитанных.
  useEffect(() => {
    if (open) void loadItems();
  }, [open, unread, counts?.latest_notification_id, loadItems]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = async (item: BellItem) => {
    setOpen(false);
    if (!item.is_read) {
      setItems((cur) => cur?.map((x) => (x.id === item.id ? { ...x, is_read: true } : x)) ?? cur);
      applyCrmReadOptimistic({
        notifications: 1,
        inquiries: item.target.kind === "lead" ? 1 : 0,
        sale_requests: item.target.kind === "sale_request" ? 1 : 0,
      });
      try {
        // Server-side this also writes the item's read receipt (one read state).
        await fetchWithCrmAuthRetry(`/api/crm/notifications/${item.id}/mark-read/`, {
          method: "POST",
        });
      } catch {
        /* открытие заявки само отметит её уведомления прочитанными */
      }
      applyCrmReadOptimistic({}); // confirm
    }
    router.push(crmNotificationHref(item.target));
  };

  /** «Прочитать все» гасит И колокольчик, И сами заявки (квитанции на
      сервере) — бейдж в боковом меню и точки в строках гаснут сразу. */
  const markAll = async () => {
    const unreadItems = (items ?? []).filter((x) => !x.is_read);
    const leads = new Set(unreadItems.filter((x) => x.target.kind === "lead").map((x) => x.target.id));
    const srs = new Set(
      unreadItems.filter((x) => x.target.kind === "sale_request").map((x) => x.target.id),
    );
    setItems((cur) => cur?.map((x) => ({ ...x, is_read: true })) ?? cur);
    applyCrmReadOptimistic({ allNotifications: true, inquiries: leads.size, sale_requests: srs.size });
    try {
      const res = await fetchWithCrmAuthRetry("/api/crm/notifications/mark-all-read/", {
        method: "POST",
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setFailed(true);
    }
    applyCrmReadOptimistic({});
  };

  const hasUnread = unread > 0;

  return (
    <div ref={wrapRef} className="relative shrink-0" data-crm-bell>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={hasUnread ? `Уведомления: ${unread} непрочитанных` : "Уведомления"}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors duration-150",
          hasUnread
            ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15"
            : "border-border bg-surface-raised text-fg-secondary hover:border-border-strong hover:bg-gray-50",
        )}
      >
        {/* Мягкая пульсация — только при непрочитанных и только без
            prefers-reduced-motion (motion-safe). */}
        {hasUnread && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-lg bg-accent/10 motion-safe:animate-pulse"
          />
        )}
        <Icons.Bell className="relative h-5 w-5" aria-hidden />
        {/* Бейдж — absolute внутри кнопки: ширина строки шапки не зависит от числа. */}
        {hasUnread && (
          <span
            aria-hidden
            className="pointer-events-none absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-surface-raised"
          >
            {formatUnreadBadge(unread)}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Уведомления"
          /* Below sm the bell is NOT at the screen edge (the hamburger sits to
             its right), so a right-aligned absolute panel spilled off the LEFT
             edge at 390px [measured] — invisible to scrollWidth, which ignores
             left overflow. There it is pinned to the viewport instead. */
          className="fixed inset-x-4 top-[4.5rem] z-[1100] overflow-hidden rounded-xl border border-border bg-surface-raised shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold text-fg">Уведомления</span>
            <button
              type="button"
              onClick={() => void markAll()}
              disabled={!hasUnread}
              className="text-xs font-medium text-blue-700 hover:underline disabled:cursor-default disabled:text-fg-muted disabled:no-underline"
            >
              Прочитать все
            </button>
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {failed ? (
              <p className="px-4 py-6 text-center text-sm text-red-600">
                Не удалось загрузить уведомления.
              </p>
            ) : items === null ? (
              <p className="px-4 py-6 text-center text-sm text-fg-muted">Загрузка…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-fg-muted">
                За последние 24 часа уведомлений нет.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void openItem(item)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50",
                        !item.is_read && "bg-blue-50/60",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          item.is_read ? "bg-transparent" : "bg-accent",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-fg-secondary">
                          {item.type_label}
                        </span>
                        <span
                          className={cn(
                            "block truncate text-sm text-fg",
                            !item.is_read && "font-semibold",
                          )}
                        >
                          {item.title}
                        </span>
                        <span className="block truncate text-xs text-fg-muted">
                          {item.context} · {relativeTime(item.created_at, now)}
                        </span>
                      </span>
                      {!item.is_read && <span className="sr-only">Не прочитано</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-4 py-2.5 text-right">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/account/inquiries");
              }}
              className="text-sm font-medium text-blue-700 hover:underline"
            >
              Все заявки
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
