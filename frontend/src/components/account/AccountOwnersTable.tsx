"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OwnerModal, type OwnerData } from "@/components/crm/OwnerModal";
import { fetchWithCrmAuthRetry, getCrmAccessToken } from "@/lib/crmAuth";
import { isCabinetAdminRole } from "@/lib/employeeUser";
import { useEmployeeUser } from "@/components/account/EmployeeAuthContext";
import { cn } from "@/lib/utils";

interface OwnerLinkedProperty {
  id: number;
  crm_property_id: string;
  title_generated: string;
  status: string;
  status_label: string;
}

interface OwnerRow extends OwnerData {
  properties: OwnerLinkedProperty[];
  created_at: string;
}

const SEARCH_DEBOUNCE_MS = 350;

function propertyStatusBadgeClass(status: string): string {
  switch (status) {
    case "published":
      return "bg-emerald-100 text-emerald-900";
    case "moderation":
      return "bg-amber-100 text-amber-900";
    case "archived":
      return "bg-slate-200 text-slate-600";
    default: // draft
      return "bg-slate-100 text-slate-700";
  }
}

export function AccountOwnersTable() {
  // Same staff-level check the rest of the CRM uses for admin-only UI; matches
  // the backend's has_staff_level_access gate on DELETE /api/crm/owners/{id}/.
  const user = useEmployeeUser();
  const isAdmin = isCabinetAdminRole(user.role);

  const [rows, setRows] = useState<OwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editOwner, setEditOwner] = useState<OwnerData | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef(search);
  searchRef.current = search;
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(""), 3000);
  };

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const load = useCallback(async () => {
    if (!getCrmAccessToken()) {
      setError("Требуется вход.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const term = searchRef.current.trim();
      const qs = term ? `?search=${encodeURIComponent(term)}` : "";
      const res = await fetchWithCrmAuthRetry(`/api/crm/owners/${qs}`);
      if (!res.ok) {
        setError("Не удалось загрузить собственников.");
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.results ?? []);
      setRows(list as OwnerRow[]);
    } catch (e) {
      console.error("[AccountOwnersTable] load", e);
      setError("Ошибка соединения.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + debounced reload on search change (server-side ?search=,
  // the same endpoint the OwnerModal reuse-search uses: ФИО, phone digits, or
  // the PID of a linked property).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void load(), SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, load]);

  const openCreate = () => {
    setEditOwner(null);
    setModalOpen(true);
  };
  const openEdit = (o: OwnerRow) => {
    setEditOwner(o);
    setModalOpen(true);
  };

  // Admin-only. Linked properties keep existing but lose their owner
  // (Property.owner is SET_NULL) — the confirm message spells that out.
  const handleDelete = async (o: OwnerRow) => {
    const linked = o.properties.length;
    const linkedWarning = linked
      ? ` Привязанные объекты (${linked}) останутся без собственника.`
      : "";
    if (
      !window.confirm(
        `Удалить собственника «${o.full_name}»?${linkedWarning} Это действие нельзя отменить.`,
      )
    ) {
      return;
    }
    setDeleteBusyId(o.id);
    setError("");
    try {
      const res = await fetchWithCrmAuthRetry(`/api/crm/owners/${o.id}/`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        setError("Не удалось удалить собственника.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== o.id));
      showNotice(`Собственник «${o.full_name}» удалён.`);
    } catch (e) {
      console.error("[AccountOwnersTable] delete", e);
      setError("Ошибка соединения при удалении собственника.");
    } finally {
      setDeleteBusyId(null);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-sm">
          <Input
            type="text"
            placeholder="Поиск по ФИО, телефону или номеру объекта (PID)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="button" onClick={openCreate}>
          + Добавить собственника
        </Button>
      </div>

      {notice && <p className="mt-3 text-sm font-medium text-emerald-700">{notice}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Загрузка…</p>
      ) : error ? (
        <p className="mt-6 text-sm text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-700">
            {search.trim()
              ? "Никого не найдено по этому запросу."
              : "Собственников пока нет. Добавьте первого — объект можно привязать позже."}
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Собственник</th>
                <th className="px-4 py-3">Телефон</th>
                <th className="px-4 py-3">Объекты</th>
                <th className="px-4 py-3">Примечание</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((o) => (
                <tr key={o.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {o.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Django media URL
                        <img
                          src={o.photo}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                        />
                      ) : (
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                          aria-hidden
                        >
                          {(o.full_name.trim().charAt(0) || "?").toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-slate-900">{o.full_name}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{o.phone}</td>
                  <td className="px-4 py-3">
                    {o.properties.length === 0 ? (
                      <span className="text-slate-400">нет объектов</span>
                    ) : (
                      <ul className="space-y-1">
                        {o.properties.map((p) => (
                          <li key={p.id} className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/account/properties/${p.id}`}
                              className="font-medium text-blue-600 hover:underline"
                            >
                              {p.crm_property_id}
                            </Link>
                            <span className="text-slate-700">{p.title_generated}</span>
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                                propertyStatusBadgeClass(p.status),
                              )}
                            >
                              {p.status_label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-slate-600">
                    <span className="line-clamp-2" title={o.note || undefined}>
                      {o.note || "—"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        className="text-sm font-medium text-blue-600 hover:underline"
                        onClick={() => openEdit(o)}
                      >
                        Изменить
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                          disabled={deleteBusyId === o.id}
                          onClick={() => void handleDelete(o)}
                        >
                          {deleteBusyId === o.id ? "Удаление…" : "Удалить"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OwnerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        variant="registry"
        initialOwner={editOwner}
        onLinked={() => void load()}
      />
    </div>
  );
}
