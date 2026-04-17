"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fetchWithCrmAuthRetry, getCrmAccessToken } from "@/lib/crmAuth";
import { isCabinetAdminRole } from "@/lib/employeeUser";
import { useEmployeeUser } from "@/components/account/EmployeeAuthContext";

type ActivityRow = {
  id: number;
  user: number;
  user_email: string;
  user_display_name: string;
  action_type: string;
  action_label: string;
  created_at: string;
  ip_address: string | null;
  user_agent: string;
};

function normalizeList(data: unknown): ActivityRow[] {
  if (Array.isArray(data)) return data as ActivityRow[];
  if (data && typeof data === "object" && "results" in data) {
    const r = (data as { results?: unknown }).results;
    if (Array.isArray(r)) return r as ActivityRow[];
  }
  return [];
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      dateStyle: "short",
      timeStyle: "medium",
    });
  } catch {
    return iso;
  }
}

export function AccountActivityLogsPanel() {
  const me = useEmployeeUser();
  const allowed = isCabinetAdminRole(me.role);

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");

  const load = useCallback(async () => {
    if (!allowed) return;
    const token = getCrmAccessToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (actionFilter === "login" || actionFilter === "logout") {
        params.set("action_type", actionFilter);
      }
      const uid = userFilter.trim();
      if (uid && /^\d+$/.test(uid)) {
        params.set("user", uid);
      }
      const q = params.toString();
      const url = q ? `/api/crm/activity-logs/?${q}` : "/api/crm/activity-logs/";
      const res = await fetchWithCrmAuthRetry(url);
      if (res.status === 403) {
        setError("Нет доступа к журналу.");
        setRows([]);
        return;
      }
      if (!res.ok) {
        console.error("[activity-logs] HTTP", res.status);
        setError("Не удалось загрузить журнал.");
        setRows([]);
        return;
      }
      const data = await res.json();
      setRows(normalizeList(data));
    } catch (e) {
      console.error("[activity-logs]", e);
      setError("Ошибка соединения.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [allowed, actionFilter, userFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Раздел доступен только администратору.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[12rem]">
          <label htmlFor="activity-action" className="mb-1 block text-xs font-medium text-slate-600">
            Действие
          </label>
          <Select
            id="activity-action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full"
          >
            <option value="">Все</option>
            <option value="login">Вход</option>
            <option value="logout">Выход</option>
          </Select>
        </div>
        <div className="min-w-[10rem]">
          <label htmlFor="activity-user" className="mb-1 block text-xs font-medium text-slate-600">
            ID пользователя
          </label>
          <Input
            id="activity-user"
            type="text"
            inputMode="numeric"
            placeholder="например, 5"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="w-full sm:w-40"
          />
        </div>
        <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
          {loading ? "Загрузка…" : "Обновить"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Сотрудник</th>
              <th className="px-4 py-3">Действие</th>
              <th className="px-4 py-3">Дата и время</th>
              <th className="px-4 py-3">IP-адрес</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Записей нет.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{r.user_display_name}</div>
                    <div className="text-xs text-slate-500">{r.user_email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-800">{r.action_label}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatWhen(r.created_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.ip_address ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
