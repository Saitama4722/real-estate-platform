"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchWithCrmAuthRetry, authBearerHeaders } from "@/lib/crmAuth";
import { crmBrowserApiUrl } from "@/lib/crmAuthConstants";

export interface OwnerData {
  id: number;
  full_name: string;
  phone: string;
  photo: string | null;
  note: string;
  properties_count?: number;
}

interface OwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** PID / identifier of the property being edited (context for the user). */
  propertyLabel?: string;
  /** The currently linked owner (if any) — enables the "unlink" affordance. */
  currentOwner?: OwnerData | null;
  /** Called when an owner is chosen/created/updated and should be linked. */
  onLinked: (owner: OwnerData) => void;
  /** Called when the user clears the owner link on this property. */
  onUnlinked?: () => void;
  /**
   * "link" (default) — the property-form flow: search/reuse an owner and link
   * it to the property. "registry" — the standalone Собственники page: create
   * or edit an owner with NO property context (no search step, no link wording;
   * a pre-registered owner can be linked to a property later via this modal's
   * link flow). In registry mode `onLinked` simply reports the saved owner.
   */
  variant?: "link" | "registry";
  /** Registry variant only: open directly editing this owner; omit to create. */
  initialOwner?: OwnerData | null;
}

const PHONE_EMPTY = "+7 ";

function formatPhoneMask(raw: string): string {
  let digits = (raw.match(/\d/g) ?? []).join("");
  if (digits.startsWith("7") || digits.startsWith("8")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length === 0) return PHONE_EMPTY;
  const a = digits.slice(0, 3), b = digits.slice(3, 6), c = digits.slice(6, 8), d = digits.slice(8, 10);
  let out = `+7 (${a}`;
  if (digits.length >= 3) out += ")";
  if (b) out += ` ${b}`;
  if (c) out += `-${c}`;
  if (d) out += `-${d}`;
  return out;
}
function stripName(v: string): string {
  return v.replace(/[^a-zA-Zа-яА-ЯёЁ\s.-]/g, "");
}
function countDigits(v: string): number {
  return (v.match(/\d/g) ?? []).length;
}

type Mode =
  | { kind: "search" }
  | { kind: "create" }
  | { kind: "edit"; owner: OwnerData };

export function OwnerModal({
  isOpen,
  onClose,
  propertyLabel,
  currentOwner,
  onLinked,
  onUnlinked,
  variant = "link",
  initialOwner = null,
}: OwnerModalProps) {
  const [mode, setMode] = useState<Mode>({ kind: "search" });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OwnerData[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Create/edit form fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState(PHONE_EMPTY);
  const [note, setNote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset each time the modal opens: the link flow starts at search; the
  // registry flow skips search and opens straight in create or edit.
  useEffect(() => {
    if (isOpen) {
      if (variant === "registry") {
        if (initialOwner) {
          setMode({ kind: "edit", owner: initialOwner });
          setFullName(initialOwner.full_name);
          setPhone(initialOwner.phone || PHONE_EMPTY);
          setNote(initialOwner.note || "");
        } else {
          setMode({ kind: "create" });
          setFullName("");
          setPhone(PHONE_EMPTY);
          setNote("");
        }
      } else {
        setMode({ kind: "search" });
        setFullName("");
        setPhone(PHONE_EMPTY);
        setNote("");
      }
      setQuery("");
      setResults([]);
      setError("");
      setPhotoFile(null);
    }
  }, [isOpen, variant, initialOwner]);

  // Debounced search by phone or ФИО.
  const runSearch = useCallback(async (q: string) => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetchWithCrmAuthRetry(
        `/api/crm/owners/?search=${encodeURIComponent(term)}`,
      );
      if (!res.ok) {
        setResults([]);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.results ?? []);
      setResults(list as OwnerData[]);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (mode.kind !== "search") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode.kind, runSearch]);

  const startCreate = () => {
    setError("");
    // Seed the create form with whatever was typed (phone digits or a name).
    if (countDigits(query) >= 3) {
      setPhone(formatPhoneMask(query));
      setFullName("");
    } else {
      setFullName(stripName(query));
      setPhone(PHONE_EMPTY);
    }
    setNote("");
    setPhotoFile(null);
    setMode({ kind: "create" });
  };

  const startEdit = (owner: OwnerData) => {
    setError("");
    setFullName(owner.full_name);
    setPhone(owner.phone || PHONE_EMPTY);
    setNote(owner.note || "");
    setPhotoFile(null);
    setMode({ kind: "edit", owner });
  };

  const validate = (): string => {
    if (!fullName.trim()) return "Укажите ФИО собственника.";
    if (countDigits(phone) < 10) return "Укажите корректный номер телефона.";
    return "";
  };

  const submitOwner = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const isEdit = mode.kind === "edit";
      const url = isEdit
        ? `/api/crm/owners/${(mode as { owner: OwnerData }).owner.id}/`
        : `/api/crm/owners/`;
      const method = isEdit ? "PATCH" : "POST";

      let res: Response;
      if (photoFile) {
        const fd = new FormData();
        fd.append("full_name", fullName.trim());
        fd.append("phone", phone.trim());
        fd.append("note", note.trim());
        fd.append("photo", photoFile);
        // Multipart: don't set Content-Type (browser sets boundary). Use auth only.
        res = await fetch(crmBrowserApiUrl(url), {
          method,
          headers: { ...authBearerHeaders() },
          body: fd,
        });
      } else {
        res = await fetchWithCrmAuthRetry(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: fullName.trim(),
            phone: phone.trim(),
            note: note.trim(),
          }),
        });
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const firstErr =
          (Array.isArray(data.full_name) && String(data.full_name[0])) ||
          (Array.isArray(data.phone) && String(data.phone[0])) ||
          (typeof data.detail === "string" && data.detail) ||
          "Не удалось сохранить собственника.";
        setError(firstErr);
        return;
      }
      const owner = (await res.json()) as OwnerData;
      onLinked(owner);
      onClose();
    } catch {
      setError("Ошибка соединения.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-xl">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Данные собственника</h2>
          {propertyLabel && (
            <p className="mt-0.5 text-xs text-gray-500">Объект: {propertyLabel}</p>
          )}
        </div>

        {/* ── SEARCH / REUSE ───────────────────────────────────────── */}
        {mode.kind === "search" && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Найти существующего собственника
              </label>
              <Input
                type="text"
                placeholder="Телефон или ФИО"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              <p className="mt-1 text-xs text-gray-500">
                Начните вводить номер телефона или имя — если человек уже есть в
                базе, выберите его, чтобы не создавать дубликат.
              </p>
            </div>

            {currentOwner && (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                <p className="font-medium text-blue-900">
                  Текущий собственник: {currentOwner.full_name}
                </p>
                <p className="text-blue-800">{currentOwner.phone}</p>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    className="text-xs font-medium text-blue-700 underline"
                    onClick={() => startEdit(currentOwner)}
                  >
                    Изменить данные
                  </button>
                  {onUnlinked && (
                    <button
                      type="button"
                      className="text-xs font-medium text-red-600 underline"
                      onClick={() => {
                        onUnlinked();
                        onClose();
                      }}
                    >
                      Открепить от объекта
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="max-h-64 overflow-auto rounded-md border border-gray-200">
              {searching ? (
                <p className="px-3 py-3 text-sm text-gray-500">Поиск…</p>
              ) : results.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {results.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{o.full_name}</p>
                        <p className="text-xs text-gray-600">
                          {o.phone}
                          {o.properties_count ? ` · объектов: ${o.properties_count}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-gray-500 underline"
                          onClick={() => startEdit(o)}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                          onClick={() => {
                            onLinked(o);
                            onClose();
                          }}
                        >
                          Выбрать
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : query.trim().length >= 2 ? (
                <p className="px-3 py-3 text-sm text-gray-500">
                  Ничего не найдено. Создайте нового собственника.
                </p>
              ) : (
                <p className="px-3 py-3 text-sm text-gray-400">
                  Введите телефон или ФИО для поиска.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Отмена
              </Button>
              <Button type="button" onClick={startCreate}>
                + Новый собственник
              </Button>
            </div>
          </div>
        )}

        {/* ── CREATE / EDIT ────────────────────────────────────────── */}
        {(mode.kind === "create" || mode.kind === "edit") && (
          <div className="space-y-3">
            {mode.kind === "edit" && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Внимание: изменение данных собственника затронет ВСЕ объекты, к
                которым он привязан
                {typeof mode.owner.properties_count === "number"
                  ? ` (${mode.owner.properties_count})`
                  : ""}
                .
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                ФИО <span className="text-red-600">*</span>
              </label>
              <Input
                type="text"
                placeholder="Иван Иванов"
                value={fullName}
                onChange={(e) => setFullName(stripName(e.target.value))}
                disabled={saving}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Телефон <span className="text-red-600">*</span>
              </label>
              <Input
                type="tel"
                placeholder="+7 (___) ___-__-__"
                value={phone}
                onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
                disabled={saving}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Фото (необязательно)
              </label>
              <input
                type="file"
                accept="image/*"
                disabled={saving}
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm hover:file:bg-gray-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Примечание (необязательно)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={saving}
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-between border-t pt-3">
              {variant === "registry" ? (
                <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                  Отмена
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode({ kind: "search" })}
                  disabled={saving}
                >
                  ← Назад к поиску
                </Button>
              )}
              <Button type="button" onClick={submitOwner} disabled={saving}>
                {saving
                  ? "Сохранение…"
                  : mode.kind === "edit"
                    ? "Сохранить изменения"
                    : variant === "registry"
                      ? "Создать"
                      : "Создать и привязать"}
              </Button>
            </div>
          </div>
        )}

        {mode.kind === "search" && error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
    </Modal>
  );
}
