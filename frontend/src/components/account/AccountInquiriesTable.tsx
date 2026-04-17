"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchWithCrmAuthRetry, getCrmAccessToken } from "@/lib/crmAuth";
import { playCrmNewInquirySound } from "@/lib/crmInquiryNotifySound";
import { isCabinetAdminRole } from "@/lib/employeeUser";
import { cn } from "@/lib/utils";
import { useEmployeeUser } from "@/components/account/EmployeeAuthContext";

const INQUIRIES_POLL_INTERVAL_MS = 15_000;
const NEW_INQUIRY_HIGHLIGHT_MS = 45_000;

type LeadRow = {
  id: number;
  client_name: string;
  client_phone: string;
  client_message: string;
  status: string;
  created_at: string;
  assigned_realtor: { id: number; first_name: string; last_name: string } | null;
};

type RealtorOpt = { id: number; display_name: string };

/** Значения и подписи как в `leads.choices.LeadStatus` на backend. */
const WORKFLOW_STATUSES = [
  { value: "new", label: "Новый" },
  { value: "in_progress", label: "В работе" },
  { value: "called", label: "Связан с клиентом" },
  { value: "no_answer", label: "Нет ответа" },
  { value: "recall_later", label: "Перезвонить позже" },
  { value: "completed", label: "Завершено" },
  { value: "closed", label: "Закрыт" },
  { value: "rejected", label: "Отклонён" },
] as const;

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  WORKFLOW_STATUSES.map((s) => [s.value, s.label]),
);

function statusBadgeClass(status: string): string {
  switch (status) {
    case "new":
      return "bg-sky-100 text-sky-900";
    case "in_progress":
      return "bg-amber-100 text-amber-900";
    case "called":
      return "bg-emerald-100 text-emerald-900";
    case "completed":
      return "bg-teal-100 text-teal-900";
    case "no_answer":
      return "bg-orange-100 text-orange-900";
    case "recall_later":
      return "bg-violet-100 text-violet-900";
    case "closed":
      return "bg-slate-200 text-slate-800";
    case "rejected":
      return "bg-rose-100 text-rose-900";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function normalizeLeadList(data: unknown): LeadRow[] {
  if (Array.isArray(data)) return data as LeadRow[];
  if (data && typeof data === "object" && "results" in data) {
    const r = (data as { results?: unknown }).results;
    if (Array.isArray(r)) return r as LeadRow[];
  }
  return [];
}

type NoteApiRow = {
  id: number;
  text: string;
  author: { id: number; first_name: string; last_name: string } | null;
  created_at: string;
};

type HistoryApiRow = {
  id: number;
  action_type: string;
  description: string;
  user: { id: number; first_name: string; last_name: string } | null;
  created_at: string;
};

function formatPersonName(
  p: { first_name: string; last_name: string } | null | undefined,
): string {
  if (!p) return "—";
  const s = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return s || "—";
}

function LeadNotesHistoryPanel({
  leadId,
  viewer,
}: {
  leadId: number;
  viewer: { id: number; first_name: string; last_name: string };
}) {
  const [notes, setNotes] = useState<NoteApiRow[]>([]);
  const [history, setHistory] = useState<HistoryApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [panelError, setPanelError] = useState("");

  const load = useCallback(async () => {
    setPanelError("");
    setLoading(true);
    try {
      const [rn, rh] = await Promise.all([
        fetchWithCrmAuthRetry(`/api/crm/leads/${leadId}/notes/`),
        fetchWithCrmAuthRetry(`/api/crm/leads/${leadId}/history/`),
      ]);
      if (!rn.ok || !rh.ok) {
        setPanelError("Не удалось загрузить заметки или историю.");
        setNotes([]);
        setHistory([]);
        return;
      }
      const notesData = (await rn.json()) as unknown;
      const histData = (await rh.json()) as unknown;
      setNotes(Array.isArray(notesData) ? (notesData as NoteApiRow[]) : []);
      setHistory(Array.isArray(histData) ? (histData as HistoryApiRow[]) : []);
    } catch {
      setPanelError("Ошибка соединения.");
      setNotes([]);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    const tempId = -Date.now();
    const optimistic: NoteApiRow = {
      id: tempId,
      text,
      author: { id: viewer.id, first_name: viewer.first_name, last_name: viewer.last_name },
      created_at: new Date().toISOString(),
    };
    setNotes((prev) => [optimistic, ...prev]);
    setNoteText("");
    setNoteBusy(true);
    setPanelError("");
    try {
      const res = await fetchWithCrmAuthRetry(`/api/crm/leads/${leadId}/notes/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("failed");
      await load();
    } catch {
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
      setPanelError("Не удалось сохранить заметку.");
    } finally {
      setNoteBusy(false);
    }
  };

  return (
    <div className="grid gap-6 border-t border-slate-200 bg-slate-50/80 px-4 py-4 md:grid-cols-2">
      {panelError ? (
        <p className="md:col-span-2 text-sm text-red-600">{panelError}</p>
      ) : null}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Внутренние заметки</h3>
        {loading ? (
          <p className="text-xs text-slate-500">Загрузка…</p>
        ) : notes.length === 0 ? (
          <p className="text-xs text-slate-500">Заметок пока нет.</p>
        ) : (
          <ul className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <p className="whitespace-pre-wrap text-slate-800">{n.text}</p>
                <p className="mt-1.5 text-xs text-slate-500">
                  {formatPersonName(n.author)}
                  {n.created_at
                    ? ` · ${new Date(n.created_at).toLocaleString("ru-RU")}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2">
          <textarea
            className="min-h-[4.5rem] w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400"
            placeholder="Текст заметки…"
            value={noteText}
            disabled={noteBusy}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={noteBusy || !noteText.trim()}
            onClick={() => void addNote()}
          >
            Добавить заметку
          </button>
        </div>
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">История действий</h3>
        {loading ? (
          <p className="text-xs text-slate-500">Загрузка…</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-slate-500">Записей пока нет.</p>
        ) : (
          <ul className="relative max-h-80 space-y-0 overflow-y-auto border-l border-slate-200 pl-4">
            {history.map((h) => (
              <li key={h.id} className="relative pb-4 last:pb-0">
                <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-slate-400" aria-hidden />
                <p className="text-sm text-slate-800">{h.description}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatPersonName(h.user)}
                  {h.created_at
                    ? ` · ${new Date(h.created_at).toLocaleString("ru-RU")}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function normalizeRealtorList(data: unknown): RealtorOpt[] {
  const raw = Array.isArray(data)
    ? data
    : data && typeof data === "object" && "results" in data
      ? (data as { results: unknown }).results
      : [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      if (typeof o.id !== "number") return null;
      const dn =
        typeof o.display_name === "string"
          ? o.display_name
          : `${typeof o.first_name === "string" ? o.first_name : ""} ${typeof o.last_name === "string" ? o.last_name : ""}`.trim();
      return { id: o.id, display_name: dn || `ID ${o.id}` };
    })
    .filter(Boolean) as RealtorOpt[];
}

export function AccountInquiriesTable() {
  const user = useEmployeeUser();
  const isAdmin = isCabinetAdminRole(user.role);
  const canView =
    isAdmin || (user.crm_capabilities?.view_clients ?? false);
  const canChangeStatus =
    isAdmin || (user.crm_capabilities?.change_status ?? false);

  const [rows, setRows] = useState<LeadRow[] | null>(null);
  const [realtors, setRealtors] = useState<RealtorOpt[]>([]);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [revealed, setRevealed] = useState<Record<number, string>>({});
  const [revealBusy, setRevealBusy] = useState<number | null>(null);
  const [expandedLeadId, setExpandedLeadId] = useState<number | null>(null);
  const [newArrivalHighlightIds, setNewArrivalHighlightIds] = useState<number[]>([]);

  const knownIdsRef = useRef<Set<number>>(new Set());
  const pollSuppressedRef = useRef(true);
  const highlightTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (statusFilter) p.set("status", statusFilter);
    if (isAdmin && assignedFilter) p.set("assigned_to", assignedFilter);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [statusFilter, assignedFilter, isAdmin]);

  const newArrivalSet = useMemo(
    () => new Set(newArrivalHighlightIds),
    [newArrivalHighlightIds],
  );

  const clearHighlightTimers = useCallback(() => {
    for (const t of Object.values(highlightTimersRef.current)) {
      clearTimeout(t);
    }
    highlightTimersRef.current = {};
  }, []);

  const scheduleHighlightFade = useCallback((ids: number[]) => {
    for (const id of ids) {
      const prev = highlightTimersRef.current[id];
      if (prev) clearTimeout(prev);
      highlightTimersRef.current[id] = setTimeout(() => {
        setNewArrivalHighlightIds((cur) => cur.filter((x) => x !== id));
        delete highlightTimersRef.current[id];
      }, NEW_INQUIRY_HIGHLIGHT_MS);
    }
  }, []);

  const registerNewArrivals = useCallback(
    (ids: number[]) => {
      if (!ids.length) return;
      setNewArrivalHighlightIds((cur) => {
        const next = new Set(cur);
        for (const id of ids) next.add(id);
        return [...next];
      });
      scheduleHighlightFade(ids);
    },
    [scheduleHighlightFade],
  );

  const dismissNewHighlight = useCallback(
    (id: number) => {
      const t = highlightTimersRef.current[id];
      if (t) {
        clearTimeout(t);
        delete highlightTimersRef.current[id];
      }
      setNewArrivalHighlightIds((cur) => cur.filter((x) => x !== id));
    },
    [],
  );

  useEffect(() => {
    clearHighlightTimers();
    setNewArrivalHighlightIds([]);
    return () => {
      clearHighlightTimers();
    };
  }, [query, clearHighlightTimers]);

  const load = useCallback(async () => {
    pollSuppressedRef.current = true;
    if (!getCrmAccessToken()) {
      setRows([]);
      knownIdsRef.current = new Set();
      pollSuppressedRef.current = false;
      return;
    }
    if (!canView) {
      setRows([]);
      knownIdsRef.current = new Set();
      setError("Недостаточно прав на просмотр заявок.");
      pollSuppressedRef.current = false;
      return;
    }
    setError("");
    try {
      const res = await fetchWithCrmAuthRetry(`/api/crm/leads/${query}`);
      if (res.status === 403) {
        setRows([]);
        knownIdsRef.current = new Set();
        setError("Недостаточно прав на просмотр заявок.");
        pollSuppressedRef.current = false;
        return;
      }
      if (!res.ok) {
        setRows([]);
        knownIdsRef.current = new Set();
        setError("Не удалось загрузить заявки.");
        pollSuppressedRef.current = false;
        return;
      }
      const data = await res.json();
      const list = normalizeLeadList(data);
      setRows(list);
      knownIdsRef.current = new Set(list.map((r) => r.id));
      pollSuppressedRef.current = false;
    } catch {
      setRows([]);
      knownIdsRef.current = new Set();
      setError("Ошибка соединения.");
      pollSuppressedRef.current = false;
    }
  }, [query, canView]);

  const pollLeads = useCallback(async () => {
    if (!getCrmAccessToken() || !canView) return;
    if (pollSuppressedRef.current) return;
    try {
      const res = await fetchWithCrmAuthRetry(`/api/crm/leads/${query}`);
      if (res.status === 403 || !res.ok) return;
      const list = normalizeLeadList(await res.json());
      const prevKnown = knownIdsRef.current;
      const freshIds = list.map((r) => r.id).filter((id) => !prevKnown.has(id));
      if (freshIds.length > 0) {
        playCrmNewInquirySound();
        registerNewArrivals(freshIds);
      }
      setRows(list);
      knownIdsRef.current = new Set(list.map((r) => r.id));
    } catch {
      /* ignore transient poll errors */
    }
  }, [query, canView, registerNewArrivals]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canView) return;
    const id = window.setInterval(() => {
      void pollLeads();
    }, INQUIRIES_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [canView, pollLeads]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithCrmAuthRetry("/api/crm/realtors/");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setRealtors(normalizeRealtorList(data));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const patchStatus = async (id: number, status: string) => {
    const snapshot = rows;
    setRows((prev) =>
      (prev ?? []).map((r) => (r.id === id ? { ...r, status } : r)),
    );
    try {
      const res = await fetchWithCrmAuthRetry(`/api/crm/leads/${id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("patch failed");
      const data = (await res.json()) as Partial<LeadRow>;
      setRows((prev) =>
        (prev ?? []).map((r) => (r.id === id ? { ...r, ...data } : r)),
      );
    } catch {
      setRows(snapshot);
      setError("Не удалось сохранить статус. Попробуйте снова.");
    }
  };

  const revealPhone = async (id: number) => {
    setRevealBusy(id);
    setError("");
    try {
      const res = await fetchWithCrmAuthRetry(`/api/crm/leads/${id}/reveal_phone/`, {
        method: "POST",
      });
      if (res.status === 429) {
        setError("Слишком частые запросы на показ телефона. Подождите минуту.");
        return;
      }
      if (!res.ok) {
        setError("Не удалось получить номер телефона.");
        return;
      }
      const data = (await res.json()) as { phone?: string };
      if (data.phone) setRevealed((prev) => ({ ...prev, [id]: data.phone! }));
    } catch {
      setError("Ошибка соединения при раскрытии телефона.");
    } finally {
      setRevealBusy(null);
    }
  };

  if (!canView) {
    return (
      <p className="mt-4 text-sm text-slate-600">
        Обратитесь к администратору, чтобы включить право «Просматривать клиентов (заявки)».
      </p>
    );
  }

  if (rows === null) {
    return <p className="mt-4 text-sm text-slate-600">Загрузка…</p>;
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Статус
          <select
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Все</option>
            {WORKFLOW_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {isAdmin && (
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Ответственный
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
            >
              <option value="">Все</option>
              {realtors.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.display_name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">Заявок по выбранным фильтрам нет.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5">Имя</th>
                <th className="px-3 py-2.5">Телефон</th>
                <th className="px-3 py-2.5">Сообщение</th>
                <th className="px-3 py-2.5">Статус</th>
                <th className="px-3 py-2.5">Создана</th>
                <th className="px-3 py-2.5">Действия</th>
                <th className="px-3 py-2.5 w-28">Подробнее</th>
              </tr>
            </thead>
            <tbody>
                           {rows.map((r) => (
                <Fragment key={r.id}>
                <tr
                  className={cn(
                    "border-b border-slate-100 last:border-0 transition-colors duration-300",
                    newArrivalSet.has(r.id) &&
                      "bg-amber-50/90 shadow-[inset_3px_0_0_0] shadow-amber-400",
                  )}
                >
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{r.client_name}</span>
                      {newArrivalSet.has(r.id) ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950 ring-1 ring-amber-300/80">
                          Новая заявка
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-800">
                    {revealed[r.id] ?? r.client_phone}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2.5 text-slate-600" title={r.client_message}>
                    {r.client_message?.trim() ? r.client_message : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1.5">
                      <span
                        className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(r.status)}`}
                      >
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                      {canChangeStatus ? (
                        <select
                          className="max-w-[11rem] rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-900"
                          value={
                            WORKFLOW_STATUSES.some((s) => s.value === r.status)
                              ? r.status
                              : "__pick__"
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v && v !== "__pick__") void patchStatus(r.id, v);
                          }}
                        >
                          <option value="__pick__" disabled>
                            Сменить…
                          </option>
                          {WORKFLOW_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                    {r.created_at ? new Date(r.created_at).toLocaleString("ru-RU") : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {revealed[r.id] ? (
                      <span className="text-xs text-slate-500">Номер открыт</span>
                    ) : (
                      <button
                        type="button"
                        className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        disabled={revealBusy === r.id}
                        onClick={() => void revealPhone(r.id)}
                      >
                        {revealBusy === r.id ? "…" : "Показать телефон"}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      className="text-xs font-medium text-sky-700 underline-offset-2 hover:underline"
                      aria-expanded={expandedLeadId === r.id}
                      onClick={() => {
                        setExpandedLeadId((cur) => {
                          const next = cur === r.id ? null : r.id;
                          if (next === r.id) dismissNewHighlight(r.id);
                          return next;
                        });
                      }}
                    >
                      {expandedLeadId === r.id ? "Свернуть" : "Подробнее"}
                    </button>
                  </td>
                </tr>
                {expandedLeadId === r.id ? (
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <td colSpan={7} className="p-0">
                      <LeadNotesHistoryPanel
                        leadId={r.id}
                        viewer={{
                          id: user.id,
                          first_name: user.first_name,
                          last_name: user.last_name,
                        }}
                      />
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
