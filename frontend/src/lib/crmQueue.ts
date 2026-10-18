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

export type CrmQueueScope = "" | "free" | "mine";

export const CRM_QUEUE_SCOPES: { value: CrmQueueScope; label: string }[] = [
  { value: "", label: "Все доступные" },
  { value: "free", label: "Свободные" },
  { value: "mine", label: "Мои" },
];

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
