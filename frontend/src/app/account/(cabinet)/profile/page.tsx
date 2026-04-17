"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authBearerHeaders } from "@/lib/crmAuth";
import { employeeAuthAbsoluteUrl } from "@/lib/crmAuthConstants";

type MeResponse = {
  first_name: string;
  last_name: string;
  phone?: string;
  avatar?: string | null;
};

export default function AccountProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(employeeAuthAbsoluteUrl("me"), { headers: authBearerHeaders() });
      if (!res.ok) {
        setError("Не удалось загрузить профиль.");
        return;
      }
      const data = (await res.json()) as MeResponse;
      setFirstName(data.first_name ?? "");
      setLastName(data.last_name ?? "");
      setPhone(data.phone ?? "");
      setAvatarUrl(typeof data.avatar === "string" ? data.avatar : null);
    } catch {
      setError("Ошибка соединения при загрузке профиля.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const headers = authBearerHeaders();
      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.append("first_name", firstName.trim());
        fd.append("last_name", lastName.trim());
        fd.append("phone", phone.trim());
        fd.append("avatar", file);
        res = await fetch(employeeAuthAbsoluteUrl("me"), { method: "PATCH", headers, body: fd });
      } else {
        res = await fetch(employeeAuthAbsoluteUrl("me"), {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: phone.trim(),
          }),
        });
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail =
          body && typeof body === "object" && "detail" in body
            ? String((body as { detail?: unknown }).detail)
            : "Не удалось сохранить изменения.";
        setError(detail);
        return;
      }
      const hadAvatarFile = Boolean(file);
      const data = (await res.json()) as MeResponse;
      setFirstName(data.first_name ?? "");
      setLastName(data.last_name ?? "");
      setPhone(data.phone ?? "");
      setAvatarUrl(typeof data.avatar === "string" ? data.avatar : null);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setOk(
        hadAvatarFile
          ? "Изменения сохранены. Новая фотография загружена."
          : "Изменения сохранены.",
      );
    } catch {
      setError("Ошибка соединения при сохранении.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeading title="Профиль" subtitle="Имя, телефон и фото для сайта и кабинета" />
      {loading ? (
        <p className="mt-4 text-sm text-gray-600">Загрузка…</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 max-w-lg space-y-5">
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
          {ok && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {ok}
            </p>
          )}

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 space-y-2">
              {filePreviewUrl ? (
                <>
                  <p className="text-xs font-medium text-slate-600">Предпросмотр нового фото</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={filePreviewUrl}
                    alt=""
                    className="h-20 w-20 rounded-full object-cover ring-2 ring-sky-300"
                  />
                </>
              ) : avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover ring-1 ring-slate-200"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-500 ring-1 ring-slate-200">
                  Нет фото
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <label htmlFor="profile-avatar" className="block text-sm font-medium text-slate-700">
                Фотография
              </label>
              <input
                ref={fileInputRef}
                id="profile-avatar"
                type="file"
                accept="image/*"
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200"
                onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
              />
              {file ? (
                <p className="text-xs text-slate-700">
                  Выбран файл: <span className="font-medium">{file.name}</span> — будет отправлен при
                  нажатии «Сохранить».
                </p>
              ) : (
                <p className="text-xs text-slate-500">Файл не выбран.</p>
              )}
              <p className="text-xs text-slate-500">Поддерживаются обычные форматы изображений.</p>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="profile-first" className="block text-sm font-medium text-slate-700">
              Имя
            </label>
            <Input
              id="profile-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="profile-last" className="block text-sm font-medium text-slate-700">
              Фамилия
            </label>
            <Input
              id="profile-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="profile-phone" className="block text-sm font-medium text-slate-700">
              Телефон
            </label>
            <Input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="+7 …"
            />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </form>
      )}
    </>
  );
}
