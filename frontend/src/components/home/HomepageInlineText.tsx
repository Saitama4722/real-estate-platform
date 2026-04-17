"use client";

import { useCallback, useEffect, useState } from "react";
import { authBearerHeaders, getCrmAccessToken } from "@/lib/crmAuth";
import type { EmployeeUser } from "@/lib/employeeUser";
import { isCabinetAdminRole } from "@/lib/employeeUser";
import type { HomepageTextBlockKey } from "@/lib/homepageTextBlocks";
import { cn } from "@/lib/utils";

type EditTrigger = "click" | "doubleClick";

type HeadingTag = "h1" | "h2" | "h3" | "p" | "span";

export interface HomepageInlineTextProps {
  blockKey: HomepageTextBlockKey;
  value: string;
  as: HeadingTag;
  className?: string;
  multiline?: boolean;
  /** Внутри кнопки — двойной щелчок, чтобы не перехватывать клик по кнопке. */
  editTrigger?: EditTrigger;
}

export function HomepageInlineText({
  blockKey,
  value: initialValue,
  as: Tag,
  className,
  multiline = false,
  editTrigger = "click",
}: HomepageInlineTextProps) {
  const [text, setText] = useState(initialValue);
  const [draft, setDraft] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [checkDone, setCheckDone] = useState(false);

  useEffect(() => {
    setText(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const t = getCrmAccessToken();
    if (!t?.trim()) {
      setCheckDone(true);
      return;
    }
    fetch("/api/auth/me/", { headers: authBearerHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("me"))))
      .then((u: EmployeeUser) => setCanEdit(isCabinetAdminRole(u.role)))
      .catch(() => setCanEdit(false))
      .finally(() => setCheckDone(true));
  }, []);

  const startEdit = useCallback(
    (e?: React.SyntheticEvent) => {
      if (e) e.stopPropagation();
      setDraft(text);
      setEditing(true);
      setStatus("idle");
    },
    [text],
  );

  const cancel = useCallback(() => {
    setDraft(text);
    setEditing(false);
    setStatus("idle");
  }, [text]);

  const save = useCallback(async () => {
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch(`/api/crm/homepage/text-blocks/${blockKey}/`, {
        method: "PATCH",
        headers: {
          ...authBearerHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: draft }),
      });
      if (!res.ok) throw new Error("save");
      const data = (await res.json()) as { value?: string };
      const next = typeof data.value === "string" ? data.value : draft;
      setText(next);
      setEditing(false);
      setStatus("ok");
      window.setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("err");
    } finally {
      setSaving(false);
    }
  }, [blockKey, draft]);

  const editableOutline =
    canEdit && !editing && checkDone
      ? "rounded-sm outline-offset-2 hover:outline hover:outline-2 hover:outline-amber-500/80"
      : "";

  const onActivate = (e: React.MouseEvent) => {
    if (!canEdit || editTrigger !== "click") return;
    e.preventDefault();
    e.stopPropagation();
    startEdit(e);
  };

  const onDoubleActivate = (e: React.MouseEvent) => {
    if (!canEdit || editTrigger !== "doubleClick") return;
    e.preventDefault();
    e.stopPropagation();
    startEdit(e);
  };

  if (editing) {
    return (
      <span className="block w-full max-w-full">
        {multiline ? (
          <textarea
            className={cn(
              "min-h-[6rem] w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
              className,
            )}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={saving}
            autoFocus
          />
        ) : (
          <input
            type="text"
            className={cn(
              "w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
              className,
            )}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={saving}
            autoFocus
          />
        )}
        <span className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? "Сохраняется…" : "Сохранить"}
          </button>
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 disabled:opacity-50"
            onClick={cancel}
            disabled={saving}
          >
            Отмена
          </button>
        </span>
        {status === "ok" ? (
          <p className="mt-2 text-sm text-green-700">Изменения сохранены</p>
        ) : null}
        {status === "err" ? (
          <p className="mt-2 text-sm text-red-600">Ошибка сохранения</p>
        ) : null}
      </span>
    );
  }

  return (
    <Tag
      className={cn(
        className,
        editableOutline,
        canEdit && editTrigger === "click" && "cursor-pointer",
        canEdit && editTrigger === "doubleClick" && "cursor-text",
      )}
      onClick={onActivate}
      onDoubleClick={onDoubleActivate}
      title={
        canEdit && checkDone
          ? editTrigger === "doubleClick"
            ? "Двойной щелчок для редактирования"
            : "Нажмите, чтобы редактировать"
          : undefined
      }
    >
      {text}
    </Tag>
  );
}
