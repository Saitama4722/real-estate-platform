"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithCrmAuthRetry, getCrmAccessToken } from "@/lib/crmAuth";
import { takeCrmItem, type CrmQueueScope } from "@/lib/crmQueue";
import { roleGetsUnreadIndicator } from "@/lib/employeeUser";
import { cn } from "@/lib/utils";
import { useEmployeeUser } from "@/components/account/EmployeeAuthContext";
import { FreeBadge, QueueScopeFilter } from "@/components/account/CrmQueueControls";

import { usePageLoading } from "@/components/layout/pageLoadingSignal";

interface LocationShort {
  id: number;
  name: string;
  slug: string;
}

interface SaleRequestRow {
  id: number;
  owner_name: string;
  owner_phone: string;
  city: LocationShort | null;
  district: LocationShort | null;
  neighborhood: LocationShort | null;
  property_type: string;
  asking_price: string | null;
  status: string;
  status_label: string;
  converted_property: number | null;
  photos_count: number;
  /** Не открывал ЛИ ЭТОТ сотрудник эту заявку. Пул общий, отметка личная —
      см. `common.crm_unread`. Для не-риэлтора всегда false. */
  is_unread?: boolean;
  /** Без ответственного: видна всем риэлторам, телефон маскирован, пока не взята. */
  is_free?: boolean;
  assigned_realtor?: { id: number; name: string } | null;
  created_at: string;
}

const STATUS_FILTERS = [
  { value: "", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "in_progress", label: "В работе" },
  { value: "converted", label: "Созданы объекты" },
  { value: "rejected", label: "Отклонённые" },
];

function statusBadgeClass(status: string): string {
  switch (status) {
    case "new":
      return "bg-sky-100 text-sky-900";
    case "in_progress":
      return "bg-amber-100 text-amber-900";
    case "converted":
      return "bg-emerald-100 text-emerald-900";
    case "rejected":
      return "bg-rose-100 text-rose-900";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(v: string | null): string {
  if (!v) return "—";
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("ru-RU").replace(/ /g, " ")} ₽`;
}

const TYPE_LABELS: Record<string, string> = {
  apartment: "Квартира",
  house: "Дом",
  land: "Участок",
  commercial: "Коммерция",
};

export function AccountSaleRequestsTable() {
  const user = useEmployeeUser();
  /** Участник очереди. Суперадмин/админ видят всё, но не берут заявки. */
  const isRealtor = roleGetsUnreadIndicator(user.role);
  const [rows, setRows] = useState<SaleRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<CrmQueueScope>("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  /* Holds the global navigation indicator until the content the user
     navigated for is really on screen. A skeleton is not a loaded page.
     See components/layout/pageLoadingSignal.ts.  */
  usePageLoading(loading);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    if (!getCrmAccessToken()) {
      setError("Требуется вход.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams();
      if (statusFilter) p.set("status", statusFilter);
      if (scope) p.set("scope", scope);
      const qs = p.toString() ? `?${p.toString()}` : "";
      const res = await fetchWithCrmAuthRetry(`/api/crm/sale-requests/${qs}`);
      if (!res.ok) {
        setError("Не удалось загрузить заявки.");
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.results ?? []);
      setRows(list as SaleRequestRow[]);
    } catch (e) {
      console.error("[AccountSaleRequestsTable] load", e);
      setError("Ошибка соединения.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  /** «Взять в работу» прямо из списка. Опоздавшему — 409, строка уходит. */
  const take = async (id: number) => {
    setBusyId(id);
    setNotice("");
    setError("");
    const res = await takeCrmItem<Partial<SaleRequestRow>>("sale_request", id);
    setBusyId(null);
    if (res.ok) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...res.data, is_free: false } : r)));
      setNotice("Заявка взята в работу.");
      return;
    }
    setNotice(res.message);
    if (res.conflict) setRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="mt-6">
      <div className="mb-3">
        <QueueScopeFilter value={scope} onChange={setScope} />
      </div>
      {notice && <p className="mb-3 text-sm text-slate-700">{notice}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              "rounded-full px-3 py-1 text-sm transition-colors",
              statusFilter === f.value
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Загрузка…</p>
      ) : error ? (
        <p className="mt-6 text-sm text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-700">Заявок на продажу пока нет.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Собственник</th>
                <th className="px-4 py-3">Локация</th>
                <th className="px-4 py-3">Тип</th>
                <th className="px-4 py-3">Цена</th>
                <th className="px-4 py-3">Фото</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatDateTime(r.created_at)}
                  </td>
                  {/* Маркер непрочитанного — точка цвета внимания плюс жирное
                      имя собственника. Тот же приём, что в таблице заявок:
                      строку не перекрашиваем, редизайна ряда нет. Открытие
                      СПИСКА ничего не гасит — только переход в карточку. */}
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <span className="flex items-center gap-2">
                      {r.is_unread ? (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-accent"
                          aria-hidden
                        />
                      ) : null}
                      <span className={r.is_unread ? "font-semibold" : undefined}>
                        {r.owner_name}
                      </span>
                      {r.is_unread ? (
                        <span className="sr-only">Не просмотрено</span>
                      ) : null}
                      {r.is_free ? <FreeBadge /> : null}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.city?.name ?? "—"}
                    {r.neighborhood?.name
                      ? `, ${r.neighborhood.name}`
                      : r.district?.name
                        ? `, ${r.district.name}`
                        : ""}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {TYPE_LABELS[r.property_type] ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {formatPrice(r.asking_price)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.photos_count}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        statusBadgeClass(r.status),
                      )}
                    >
                      {r.status_label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-3">
                      {isRealtor && r.is_free ? (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void take(r.id)}
                          className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {busyId === r.id ? "…" : "Взять в работу"}
                        </button>
                      ) : null}
                      <Link
                        href={`/account/sale-requests/${r.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Открыть
                      </Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
