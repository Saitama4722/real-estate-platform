"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { fetchWithCrmAuthRetry, getCrmAccessToken } from "@/lib/crmAuth";
import {
  CRM_PROPERTY_TYPE_LABELS,
  CRM_PROPERTY_TYPE_VALUES,
  type CrmPropertyTypeValue,
} from "@/lib/crmPropertyForm";

interface CrmPropertyRow {
  id: number;
  crm_property_id?: string;
  title_generated: string;
  slug: string | null;
  property_type: string;
  status: string;
  is_published: boolean;
  price: string;
  has_owner?: boolean;
  owner_name?: string | null;
  can_delete?: boolean;
  can_archive?: boolean;
  can_restore?: boolean;
}

type Tab = "active" | "archived";

const ARCHIVED_STATUS = "archived";

// Property types offered in the "Тип" filter (source of truth: backend
// PropertyType choices, mirrored in CRM_PROPERTY_TYPE_LABELS).
const TYPE_FILTER_OPTIONS: { value: CrmPropertyTypeValue; label: string }[] =
  CRM_PROPERTY_TYPE_VALUES.map((v) => ({
    value: v,
    label: CRM_PROPERTY_TYPE_LABELS[v],
  }));

// Statuses offered in the "Статус" filter. "archived" is intentionally omitted —
// the Активные/Архив tabs already own the archived/not-archived split, so the
// dropdown only narrows within the active statuses (backend PropertyStatus).
const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "draft", label: "Черновик" },
  { value: "moderation", label: "На модерации" },
  { value: "published", label: "Опубликован" },
];

const SEARCH_DEBOUNCE_MS = 350;

function buildListUrl(
  search: string,
  propertyType: string,
  status: string,
): string {
  const params = new URLSearchParams();
  const s = search.trim();
  if (s) params.set("search", s);
  if (propertyType) params.set("property_type", propertyType);
  if (status) params.set("status", status);
  const qs = params.toString();
  return qs ? `/api/crm/properties/?${qs}` : "/api/crm/properties/";
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
  const [tab, setTab] = useState<Tab>("active");
  const [busyId, setBusyId] = useState<number | null>(null);

  // Search + filters. `searchInput` is the raw field value; `search` is the
  // debounced value that actually drives the fetch.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Whether any search/filter is active — used to pick the right empty state.
  const hasActiveQuery =
    search.trim() !== "" || typeFilter !== "" || statusFilter !== "";

  // Keep the latest query params in a ref so reloadRows() (called from archive /
  // restore handlers) re-fetches the currently filtered list, not the full one.
  const queryRef = useRef({ search, typeFilter, statusFilter });
  queryRef.current = { search, typeFilter, statusFilter };

  // Debounce the search field (350ms) before it triggers a fetch.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Re-fetch the list from the server (not a page reload). Used after archive /
  // restore so each row's status and can_* action flags come back authoritative.
  const reloadRows = async () => {
    const { search: s, typeFilter: t, statusFilter: st } = queryRef.current;
    const res = await fetchWithCrmAuthRetry(buildListUrl(s, t, st));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setRows(normalizeList(await res.json()));
  };

  const handleArchive = async (row: CrmPropertyRow) => {
    setBusyId(row.id);
    setError("");
    try {
      const res = await fetchWithCrmAuthRetry(`/api/crm/properties/${row.id}/archive/`, {
        method: "POST",
      });
      if (!res.ok) {
        setError("Не удалось архивировать объект.");
        return;
      }
      await reloadRows();
    } catch (e) {
      console.error("[CrmPropertyTable] archive", e);
      setError("Ошибка соединения при архивировании.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (row: CrmPropertyRow) => {
    setBusyId(row.id);
    setError("");
    try {
      const res = await fetchWithCrmAuthRetry(`/api/crm/properties/${row.id}/to_draft/`, {
        method: "POST",
      });
      if (!res.ok) {
        setError("Не удалось восстановить объект из архива.");
        return;
      }
      await reloadRows();
    } catch (e) {
      console.error("[CrmPropertyTable] restore", e);
      setError("Ошибка соединения при восстановлении.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (row: CrmPropertyRow) => {
    const pid = row.crm_property_id ?? String(row.id);
    if (
      !window.confirm(
        `Вы уверены, что хотите удалить объект ${pid}? Это действие нельзя отменить.`,
      )
    ) {
      return;
    }
    setBusyId(row.id);
    setError("");
    try {
      const res = await fetchWithCrmAuthRetry(`/api/crm/properties/${row.id}/`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        setError("Не удалось удалить объект.");
        return;
      }
      // Permanently gone — drop it from the list without a page reload.
      setRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev));
    } catch (e) {
      console.error("[CrmPropertyTable] delete", e);
      setError("Ошибка соединения при удалении объекта.");
    } finally {
      setBusyId(null);
    }
  };

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
        const res = await fetchWithCrmAuthRetry(
          buildListUrl(search, typeFilter, statusFilter),
        );
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
  }, [search, typeFilter, statusFilter]);

  const allRows = rows ?? [];
  const activeCount = useMemo(
    () => allRows.filter((r) => r.status !== ARCHIVED_STATUS).length,
    [allRows],
  );
  const archivedCount = useMemo(
    () => allRows.filter((r) => r.status === ARCHIVED_STATUS).length,
    [allRows],
  );
  const visibleRows = useMemo(
    () =>
      tab === "archived"
        ? allRows.filter((r) => r.status === ARCHIVED_STATUS)
        : allRows.filter((r) => r.status !== ARCHIVED_STATUS),
    [allRows, tab],
  );

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

  const tabBtn = (key: Tab, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        tab === key
          ? "bg-blue-600 text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {label} ({count})
    </button>
  );

  return (
    <div className="mt-8 overflow-x-auto">
      <h2 className="text-lg font-semibold text-gray-900">Объекты (CRM)</h2>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Поиск по PID, ID или названию…"
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none sm:w-72"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Тип"
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none sm:w-auto"
        >
          <option value="">Тип: все</option>
          {TYPE_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Статус"
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none sm:w-auto"
        >
          <option value="">Статус: все</option>
          {STATUS_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex gap-2">
        {tabBtn("active", "Активные", activeCount)}
        {tabBtn("archived", "Архив", archivedCount)}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {visibleRows.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">
          {hasActiveQuery
            ? "Ничего не найдено."
            : tab === "archived"
              ? "В архиве пока нет объектов."
              : "Активных объектов пока нет."}
        </p>
      ) : (
        <table className="mt-4 min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500">
              <th className="py-2 pr-4 font-medium">PID</th>
              <th className="py-2 pr-4 font-medium">ID</th>
              <th className="py-2 pr-4 font-medium">Заголовок</th>
              <th className="py-2 pr-4 font-medium">Тип</th>
              <th className="py-2 pr-4 font-medium">Статус</th>
              <th className="py-2 pr-4 font-medium">Публикация</th>
              <th className="py-2 pr-4 font-medium">Цена</th>
              <th className="py-2 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
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
                  <Link
                    href={`/account/properties/${r.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {r.title_generated}
                  </Link>
                  {r.has_owner === false && (
                    <span
                      title="У объекта не заполнены данные собственника"
                      className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 align-middle"
                    >
                      ⚠ Собственник не указан
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">{typeLabelRu(r.property_type)}</td>
                <td className="py-2 pr-4">{r.status}</td>
                <td className="py-2 pr-4">{r.is_published ? "да" : "нет"}</td>
                <td className="py-2 pr-4">{r.price}</td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {tab === "archived" ? (
                      r.can_restore && (
                        <button
                          type="button"
                          onClick={() => void handleRestore(r)}
                          disabled={busyId !== null}
                          className="rounded border border-emerald-200 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          {busyId === r.id ? "…" : "Восстановить"}
                        </button>
                      )
                    ) : (
                      r.can_archive && (
                        <button
                          type="button"
                          onClick={() => void handleArchive(r)}
                          disabled={busyId !== null}
                          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        >
                          {busyId === r.id ? "…" : "Архивировать"}
                        </button>
                      )
                    )}
                    {r.can_delete ? (
                      <button
                        type="button"
                        onClick={() => void handleDelete(r)}
                        disabled={busyId !== null}
                        className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {busyId === r.id ? "…" : "Удалить"}
                      </button>
                    ) : null}
                    {!r.can_delete && !r.can_archive && !r.can_restore && (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
