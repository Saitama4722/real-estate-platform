"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithCrmAuthRetry, getCrmAccessToken } from "@/lib/crmAuth";
import { cn } from "@/lib/utils";

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
  const [rows, setRows] = useState<SaleRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
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
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
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
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mt-6">
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
                  <td className="px-4 py-3 font-medium text-slate-900">{r.owner_name}</td>
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
                    <Link
                      href={`/account/sale-requests/${r.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      Открыть
                    </Link>
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
