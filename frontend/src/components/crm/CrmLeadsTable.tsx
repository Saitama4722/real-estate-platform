"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authBearerHeaders, getCrmAccessToken } from "@/lib/crmAuth";

interface CrmLeadRow {
  id: number;
  client_name: string;
  client_phone: string;
  status: string;
  created_at: string;
}

function normalizeList(data: unknown): CrmLeadRow[] {
  if (Array.isArray(data)) return data as CrmLeadRow[];
  if (data && typeof data === "object" && "results" in data) {
    const r = (data as { results?: unknown }).results;
    if (Array.isArray(r)) return r as CrmLeadRow[];
  }
  return [];
}

export function CrmLeadsTable() {
  const [rows, setRows] = useState<CrmLeadRow[] | null>(null);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getCrmAccessToken()) {
      setUnauthenticated(true);
      setRows([]);
      return;
    }
    setUnauthenticated(false);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/crm/leads/", { headers: authBearerHeaders() });
        if (res.status === 401) {
          if (!cancelled) {
            setUnauthenticated(true);
            setRows([]);
          }
          return;
        }
        if (!res.ok) {
          console.error("[CrmLeadsTable] HTTP", res.status);
          if (!cancelled) {
            setRows([]);
            setError("Не удалось загрузить лиды.");
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setRows(normalizeList(data));
          setError("");
        }
      } catch (e) {
        console.error("[CrmLeadsTable]", e);
        if (!cancelled) {
          setRows([]);
          setError("Ошибка соединения.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (rows === null && !unauthenticated) {
    return <p className="mt-6 text-sm text-gray-600">Загрузка…</p>;
  }

  if (unauthenticated) {
    return (
      <div className="mt-6 space-y-3">
        <p className="text-sm text-gray-600">Войдите в CRM, чтобы просматривать лиды.</p>
        <Link href="/account/login" className="text-sm text-blue-600 hover:underline">
          Вход в CRM
        </Link>
      </div>
    );
  }

  if (rows !== null && rows.length === 0 && !error) {
    return <p className="mt-6 text-sm text-gray-600">Заявок пока нет.</p>;
  }

  if (rows !== null && rows.length === 0 && error) {
    return <p className="mt-6 text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="mt-6 overflow-x-auto">
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-500">
            <th className="py-2 pr-4 font-medium">ID</th>
            <th className="py-2 pr-4 font-medium">Имя</th>
            <th className="py-2 pr-4 font-medium">Телефон</th>
            <th className="py-2 pr-4 font-medium">Статус</th>
            <th className="py-2 font-medium">Создан</th>
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((r) => (
            <tr key={r.id} className="border-b border-gray-100">
              <td className="py-2 pr-4 font-mono text-xs">{r.id}</td>
              <td className="py-2 pr-4">{r.client_name}</td>
              <td className="py-2 pr-4">{r.client_phone}</td>
              <td className="py-2 pr-4">{r.status}</td>
              <td className="py-2 text-gray-600">
                {r.created_at ? new Date(r.created_at).toLocaleString("ru-RU") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
