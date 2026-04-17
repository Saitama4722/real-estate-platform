"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithCrmAuthRetry, getCrmAccessToken } from "@/lib/crmAuth";
import { CRM_PROPERTY_TYPE_LABELS, type CrmPropertyTypeValue } from "@/lib/crmPropertyForm";

interface CrmPropertyRow {
  id: number;
  crm_property_id?: string;
  title_generated: string;
  slug: string | null;
  property_type: string;
  status: string;
  is_published: boolean;
  price: string;
}

function normalizeList(data: unknown): CrmPropertyRow[] {
  if (Array.isArray(data)) return data as CrmPropertyRow[];
  if (data && typeof data === "object" && "results" in data) {
    const r = (data as { results?: unknown }).results;
    if (Array.isArray(r)) return r as CrmPropertyRow[];
  }
  return [];
}

function typeLabelRu(code: string): string {
  const k = code as CrmPropertyTypeValue;
  return CRM_PROPERTY_TYPE_LABELS[k] ?? code;
}

export function CrmPropertyTable() {
  const [rows, setRows] = useState<CrmPropertyRow[] | null>(null);
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
        const res = await fetchWithCrmAuthRetry("/api/crm/properties/");
        if (res.status === 401) {
          if (!cancelled) {
            setUnauthenticated(true);
            setRows([]);
          }
          return;
        }
        if (!res.ok) {
          console.error("[CrmPropertyTable] HTTP", res.status);
          if (!cancelled) {
            setRows([]);
            setError("Не удалось загрузить объекты.");
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setRows(normalizeList(data));
          setError("");
        }
      } catch (e) {
        console.error("[CrmPropertyTable]", e);
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
    return <p className="mt-6 text-sm text-gray-600">Загрузка списка…</p>;
  }

  if (unauthenticated) {
    return (
      <div className="mt-6 space-y-3">
        <p className="text-sm text-gray-600">Войдите в CRM, чтобы видеть объекты.</p>
        <Link href="/account/login" className="text-sm text-blue-600 hover:underline">
          Вход в CRM
        </Link>
      </div>
    );
  }

  if (rows !== null && rows.length === 0 && !error) {
    return <p className="mt-6 text-sm text-gray-600">Объектов пока нет.</p>;
  }

  if (rows !== null && rows.length === 0 && error) {
    return <p className="mt-6 text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="mt-8 overflow-x-auto">
      <h2 className="text-lg font-semibold text-gray-900">Объекты (CRM)</h2>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <table className="mt-4 min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-500">
            <th className="py-2 pr-4 font-medium">PID</th>
            <th className="py-2 pr-4 font-medium">ID</th>
            <th className="py-2 pr-4 font-medium">Заголовок</th>
            <th className="py-2 pr-4 font-medium">Тип</th>
            <th className="py-2 pr-4 font-medium">Статус</th>
            <th className="py-2 pr-4 font-medium">Публикация</th>
            <th className="py-2 font-medium">Цена</th>
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((r) => (
            <tr key={r.id} className="border-b border-gray-100">
              <td className="py-2 pr-4 font-mono text-xs">
                {r.crm_property_id ? (
                  <Link
                    href={`/account/properties/${r.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {r.crm_property_id}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-2 pr-4 font-mono text-xs">{r.id}</td>
              <td className="py-2 pr-4">
                <Link href={`/account/properties/${r.id}`} className="text-blue-600 hover:underline">
                  {r.title_generated}
                </Link>
              </td>
              <td className="py-2 pr-4">{typeLabelRu(r.property_type)}</td>
              <td className="py-2 pr-4">{r.status}</td>
              <td className="py-2 pr-4">{r.is_published ? "да" : "нет"}</td>
              <td className="py-2">{r.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
