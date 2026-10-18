/**
 * Очередь заявок CRM (2026-10-18): «Взять в работу» / «Вернуть в общие».
 *
 * Свободная заявка (`is_free`) видна всем активным риэлторам; взять её может
 * один — сервер решает гонку условным UPDATE и отвечает проигравшему 409.
 * Вернуть можно только свою заявку без объекта. Суперадмин и админ в процессе
 * не участвуют: кнопок у них нет, сервер ответил бы 403.
 */

import { fetchWithCrmAuthRetry } from "@/lib/crmAuth";
import { refreshCrmUnreadCounts } from "@/lib/crmUnreadCounts";

export type CrmQueueKind = "lead" | "sale_request";

/** "archive" = личный архив («Скрыть»), только у риэлтора. */
export type CrmQueueScope = "" | "free" | "mine" | "archive";

export const CRM_QUEUE_SCOPES: { value: CrmQueueScope; label: string; realtorOnly?: boolean }[] = [
  { value: "", label: "Все доступные" },
  { value: "free", label: "Свободные" },
  { value: "mine", label: "Мои" },
  { value: "archive", label: "Архив", realtorOnly: true },
];

export type CrmBulkAction = "mark-read" | "hide" | "unhide" | "delete";

export type CrmBulkResult =
  | { ok: true; count: number; ids: number[] }
  | { ok: false; message: string };

/**
 * Массовое действие (`common/crm_bulk.py`). `target` — явные id или «всё по
 * текущему фильтру» (`all`, тогда `query` — те же параметры, что у списка).
 * Сервер проверяет права по КАЖДОЙ строке и делает всё-или-ничего.
 */
export async function crmBulk(
  kind: CrmQueueKind,
  action: CrmBulkAction,
  target: { ids: number[] } | { all: true },
  query = "",
): Promise<CrmBulkResult> {
  const basePath = kind === "lead" ? "/api/crm/leads" : "/api/crm/sale-requests";
  try {
    const res = await fetchWithCrmAuthRetry(`${basePath}/bulk-${action}/${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(target),
    });
    const body = (await res.json().catch(() => null)) as
      | { count?: number; ids?: number[]; detail?: string; ids_error?: string }
      | null;
    if (!res.ok) {
      return { ok: false, message: body?.detail || "Не удалось выполнить действие." };
    }
    return { ok: true, count: body?.count ?? 0, ids: body?.ids ?? [] };
  } catch {
    return { ok: false, message: "Ошибка соединения." };
  }
}

export const ALREADY_TAKEN_MESSAGE = "Заявку уже взял другой риэлтор.";

export type CrmQueueResult<T> =
  | { ok: true; data: T }
  | { ok: false; conflict: boolean; message: string };

function base(kind: CrmQueueKind, id: number): string {
  return kind === "lead" ? `/api/crm/leads/${id}` : `/api/crm/sale-requests/${id}`;
}

async function post<T>(kind: CrmQueueKind, id: number, action: "take" | "return") {
  try {
    const res = await fetchWithCrmAuthRetry(`${base(kind, id)}/${action}/`, { method: "POST" });
    if (res.ok) {
      refreshCrmUnreadCounts();
      return { ok: true, data: (await res.json()) as T } as CrmQueueResult<T>;
    }
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    if (res.status === 409) {
      return { ok: false, conflict: true, message: body?.detail || ALREADY_TAKEN_MESSAGE } as CrmQueueResult<T>;
    }
    return {
      ok: false,
      conflict: false,
      message: body?.detail || (action === "take" ? "Не удалось взять заявку." : "Не удалось вернуть заявку."),
    } as CrmQueueResult<T>;
  } catch {
    return { ok: false, conflict: false, message: "Ошибка соединения." } as CrmQueueResult<T>;
  }
}

export function takeCrmItem<T>(kind: CrmQueueKind, id: number) {
  return post<T>(kind, id, "take");
}

export function returnCrmItem<T>(kind: CrmQueueKind, id: number) {
  return post<T>(kind, id, "return");
}
