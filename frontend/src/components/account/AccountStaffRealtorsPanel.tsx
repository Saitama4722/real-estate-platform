"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { fetchWithCrmAuthRetry } from "@/lib/crmAuth";

export type RealtorRow = {
  id: number;
  crm_id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  phone: string;
  role: string;
  is_active: boolean;
  avatar: string | null;
  last_login: string | null;
  perm_create_property: boolean;
  perm_edit_property: boolean;
  perm_delete_property: boolean;
  perm_view_clients: boolean;
  perm_delete_clients: boolean;
  perm_change_status: boolean;
};

type RealtorPermField =
  | "perm_create_property"
  | "perm_edit_property"
  | "perm_delete_property"
  | "perm_view_clients"
  | "perm_delete_clients"
  | "perm_change_status";

const DEFAULT_PERMS: Record<RealtorPermField, boolean> = {
  perm_create_property: false,
  perm_edit_property: false,
  perm_delete_property: false,
  perm_view_clients: false,
  perm_delete_clients: false,
  perm_change_status: false,
};

const PERM_CHECKBOXES: { field: RealtorPermField; label: string }[] = [
  { field: "perm_create_property", label: "Создавать объекты в CRM" },
  { field: "perm_edit_property", label: "Редактировать объекты в CRM" },
  { field: "perm_delete_property", label: "Архивировать объекты в CRM" },
  { field: "perm_view_clients", label: "Просматривать заявки (лиды)" },
  { field: "perm_delete_clients", label: "Удалять клиентов (лиды)" },
  { field: "perm_change_status", label: "Менять статус лидов" },
];

const ROLE_LABEL: Record<string, string> = {
  realtor: "Риэлтор",
  admin: "Администратор",
  superadmin: "Суперадминистратор",
};

function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

function normalizeRealtorRow(r: RealtorRow): RealtorRow {
  return {
    ...r,
    perm_create_property: Boolean(r.perm_create_property),
    perm_edit_property: Boolean(r.perm_edit_property),
    perm_delete_property: Boolean(r.perm_delete_property),
    perm_view_clients: Boolean(r.perm_view_clients),
    perm_delete_clients: Boolean(r.perm_delete_clients),
    perm_change_status: Boolean(r.perm_change_status),
  };
}

function formatLastLogin(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export function AccountStaffRealtorsPanel() {
  const [rows, setRows] = useState<RealtorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RealtorRow | null>(null);
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formFirst, setFormFirst] = useState("");
  const [formLast, setFormLast] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formAvatar, setFormAvatar] = useState<File | null>(null);
  const [formPerms, setFormPerms] = useState<Record<RealtorPermField, boolean>>({
    ...DEFAULT_PERMS,
  });
  const [saving, setSaving] = useState(false);

  const setPermStatesFromRow = (row: RealtorRow | null) => {
    if (!row) {
      setFormPerms({ ...DEFAULT_PERMS });
      return;
    }
    setFormPerms({
      perm_create_property: Boolean(row.perm_create_property),
      perm_edit_property: Boolean(row.perm_edit_property),
      perm_delete_property: Boolean(row.perm_delete_property),
      perm_view_clients: Boolean(row.perm_view_clients),
      perm_delete_clients: Boolean(row.perm_delete_clients),
      perm_change_status: Boolean(row.perm_change_status),
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);
    try {
      const res = await fetchWithCrmAuthRetry("/api/crm/realtors/", {
        credentials: "same-origin",
      });
      if (res.status === 403) {
        setAccessDenied(true);
        setError(null);
        setRows([]);
        return;
      }
      if (!res.ok) {
        setError("Не удалось загрузить список риэлторов.");
        setRows([]);
        return;
      }
      const raw = (await res.json()) as unknown;
      const list = Array.isArray(raw)
        ? raw
        : raw && typeof raw === "object" && Array.isArray((raw as { results?: unknown }).results)
          ? ((raw as { results: RealtorRow[] }).results as RealtorRow[])
          : [];
      setRows(list.map(normalizeRealtorRow));
    } catch (e) {
      console.error(e);
      setError("Ошибка сети при загрузке списка.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (accessDenied) {
    return (
      <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Раздел доступен только администратору. Если вы открыли страницу по прямой ссылке, вернитесь в{" "}
        <Link href="/account" className="font-medium text-amber-950 underline underline-offset-2">
          панель кабинета
        </Link>
        .
      </p>
    );
  }

  const openCreate = () => {
    setEditing(null);
    setFormEmail("");
    setFormPassword("");
    setFormFirst("");
    setFormLast("");
    setFormPhone("");
    setFormActive(true);
    setFormAvatar(null);
    setPermStatesFromRow(null);
    setModalOpen(true);
  };

  const openEdit = (row: RealtorRow) => {
    setEditing(row);
    setFormEmail(row.email);
    setFormPassword("");
    setFormFirst(row.first_name);
    setFormLast(row.last_name);
    setFormPhone(row.phone ?? "");
    setFormActive(row.is_active);
    setFormAvatar(null);
    setPermStatesFromRow(row);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const submitForm = async () => {
    setSaving(true);
    setError(null);
    try {
      const url = editing ? `/api/crm/realtors/${editing.id}/` : "/api/crm/realtors/";
      const method = editing ? "PATCH" : "POST";

      const permPayload = { ...formPerms };

      const hasFile = formAvatar instanceof File;
      let body: BodyInit;
      const headers: Record<string, string> = {};

      if (hasFile) {
        const fd = new FormData();
        fd.set("email", formEmail.trim());
        fd.set("first_name", formFirst.trim());
        fd.set("last_name", formLast.trim());
        fd.set("phone", formPhone.trim());
        fd.set("is_active", formActive ? "true" : "false");
        (Object.keys(formPerms) as RealtorPermField[]).forEach((key) => {
          fd.set(key, formPerms[key] ? "true" : "false");
        });
        if (!editing && formPassword.trim()) {
          fd.set("password", formPassword.trim());
        } else if (editing && formPassword.trim()) {
          fd.set("password", formPassword.trim());
        }
        fd.set("avatar", formAvatar);
        body = fd;
      } else {
        headers["Content-Type"] = "application/json";
        const payload: Record<string, unknown> = {
          email: formEmail.trim(),
          first_name: formFirst.trim(),
          last_name: formLast.trim(),
          phone: formPhone.trim(),
          is_active: formActive,
          ...permPayload,
        };
        if (!editing) {
          payload.password = formPassword.trim();
        } else if (formPassword.trim()) {
          payload.password = formPassword.trim();
        }
        body = JSON.stringify(payload);
      }

      const res = await fetchWithCrmAuthRetry(url, {
        method,
        headers:
          Object.keys(headers).length > 0
            ? headers
            : hasFile
              ? undefined
              : { "Content-Type": "application/json" },
        body,
        credentials: "same-origin",
      });

      if (!res.ok) {
        const text = await res.text();
        let msg = "Не удалось сохранить.";
        try {
          const j = JSON.parse(text) as Record<string, unknown>;
          if (typeof j.detail === "string") msg = j.detail;
          else if (j.password && Array.isArray(j.password)) msg = String(j.password[0]);
          else if (j.email && Array.isArray(j.email)) msg = String(j.email[0]);
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }

      setModalOpen(false);
      await load();
    } catch (e) {
      console.error(e);
      setError("Ошибка сети при сохранении.");
    } finally {
      setSaving(false);
    }
  };

  const disableRealtor = async (row: RealtorRow) => {
    if (!window.confirm(`Отключить доступ для ${row.display_name}?`)) return;
    setError(null);
    try {
      const res = await fetchWithCrmAuthRetry(`/api/crm/realtors/${row.id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: false }),
        credentials: "same-origin",
      });
      if (!res.ok) {
        setError("Не удалось отключить учётную запись.");
        return;
      }
      await load();
    } catch (e) {
      console.error(e);
      setError("Ошибка сети.");
    }
  };

  const deleteRealtor = async (row: RealtorRow) => {
    if (
      !window.confirm(
        `Удалить учётную запись ${row.display_name} безвозвратно? Связанные данные могут быть обнулены.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      const res = await fetchWithCrmAuthRetry(`/api/crm/realtors/${row.id}/`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        setError("Не удалось удалить учётную запись.");
        return;
      }
      await load();
    } catch (e) {
      console.error(e);
      setError("Ошибка сети.");
    }
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Управление учётными записями риэлторов: CRM ID назначается автоматически.
        </p>
        <Button type="button" size="sm" onClick={openCreate}>
          Добавить риэлтора
        </Button>
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">CRM ID</th>
              <th className="px-3 py-2">Имя</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Телефон</th>
              <th className="px-3 py-2">Роль</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2">Последний вход</th>
              <th className="px-3 py-2">Аватар</th>
              <th className="px-3 py-2 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                  Нет риэлторов.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{row.crm_id}</td>
                  <td className="px-3 py-2">{row.display_name}</td>
                  <td className="px-3 py-2">{row.email}</td>
                  <td className="px-3 py-2">{row.phone || "—"}</td>
                  <td className="px-3 py-2">{roleLabel(row.role)}</td>
                  <td className="px-3 py-2">
                    {row.is_active ? (
                      <span className="text-emerald-700">Активен</span>
                    ) : (
                      <span className="text-slate-500">Отключён</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{formatLastLogin(row.last_login)}</td>
                  <td className="px-3 py-2">
                    {row.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.avatar}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => openEdit(row)}
                      >
                        Изменить
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={!row.is_active}
                        onClick={() => void disableRealtor(row)}
                      >
                        Отключить
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs text-red-700"
                        onClick={() => void deleteRealtor(row)}
                      >
                        Удалить
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={closeModal}>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          {editing ? "Риэлтор" : "Новый риэлтор"}
        </h2>
        <div className="flex flex-col gap-3">
          <label className="block text-sm">
            <span className="text-slate-600">Email</span>
            <Input
              className="mt-1"
              type="email"
              autoComplete="off"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              disabled={Boolean(editing)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">
              Пароль {editing ? "(оставьте пустым, чтобы не менять)" : ""}
            </span>
            <Input
              className="mt-1"
              type="password"
              autoComplete="new-password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-600">Имя</span>
              <Input
                className="mt-1"
                value={formFirst}
                onChange={(e) => setFormFirst(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Фамилия</span>
              <Input
                className="mt-1"
                value={formLast}
                onChange={(e) => setFormLast(e.target.value)}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-slate-600">Телефон</span>
            <Input
              className="mt-1"
              type="tel"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
            />
            <span className="text-slate-700">Активен</span>
          </label>
          <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Права в CRM (риэлтор)
            </p>
            <div className="flex flex-col gap-2">
              {PERM_CHECKBOXES.map(({ field, label }) => (
                <label key={field} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={formPerms[field]}
                    onChange={(e) =>
                      setFormPerms((p) => ({ ...p, [field]: e.target.checked }))
                    }
                  />
                  <span className="text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="block text-sm">
            <span className="text-slate-600">Аватар (файл изображения)</span>
            <Input
              className="mt-1"
              type="file"
              accept="image/*"
              onChange={(e) => setFormAvatar(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>
              Отмена
            </Button>
            <Button
              type="button"
              onClick={() => void submitForm()}
              disabled={
                saving ||
                !formEmail.trim() ||
                !formFirst.trim() ||
                !formLast.trim() ||
                (!editing && !formPassword.trim())
              }
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
