"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authBearerHeaders } from "@/lib/crmAuth";
import { employeeAuthAbsoluteUrl } from "@/lib/crmAuthConstants";
import { parseEmployeeUser } from "@/lib/employeeUser";
import { useSetEmployeeUser } from "@/components/account/EmployeeAuthContext";
import { UploadProgressBar, useUploadProgress } from "@/components/ui/upload-progress";

/** Синхронно с бэкендом (users.serializers.SHORT_BIO_MAX). */
const SHORT_BIO_MAX = 1500;

export default function AccountProfilePage() {
  const setEmployeeUser = useSetEmployeeUser();
  const upload = useUploadProgress();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [shortBio, setShortBio] = useState("");
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
      const data = (await res.json()) as { first_name?: string; last_name?: string; phone?: string; short_bio?: string; avatar?: string | null };
      setFirstName(data.first_name ?? "");
      setLastName(data.last_name ?? "");
      setPhone(data.phone ?? "");
      setShortBio(data.short_bio ?? "");
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
      const hadAvatarFile = Boolean(file);
      let raw: unknown;
      if (file) {
        // Avatar present → upload via XHR so the progress bar can track it.
        const fd = new FormData();
        fd.append("first_name", firstName.trim());
        fd.append("last_name", lastName.trim());
        fd.append("phone", phone.trim());
        fd.append("short_bio", shortBio.trim());
        fd.append("avatar", file);
        const result = await upload.run(
          { url: employeeAuthAbsoluteUrl("me"), method: "PATCH", body: fd },
          "Не удалось сохранить изменения.",
        );
        if (!result) {
          // upload.run already set the error state on the progress bar.
          return;
        }
        raw = result.data;
      } else {
        const headers = authBearerHeaders();
        const res = await fetch(employeeAuthAbsoluteUrl("me"), {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: phone.trim(),
            short_bio: shortBio.trim(),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const detail =
            body && typeof body === "object" && "detail" in body
              ? String((body as { detail?: unknown }).detail)
              : "Не удалось сохранить изменения.";
          setError(detail);
          return;
        }
        raw = await res.json();
      }

      const updated = parseEmployeeUser(raw);
      if (updated) {
        setEmployeeUser(updated);
      }
      const data = raw as { first_name?: string; last_name?: string; phone?: string; short_bio?: string; avatar?: string | null };
      setFirstName(data.first_name ?? "");
      setLastName(data.last_name ?? "");
      setPhone(data.phone ?? "");
      setShortBio(data.short_bio ?? "");
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
              <UploadProgressBar state={upload.state} className="pt-1" />
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

          <div className="space-y-1">
            <label htmlFor="profile-bio" className="block text-sm font-medium text-slate-700">
              О себе
            </label>
            <textarea
              id="profile-bio"
              value={shortBio}
              onChange={(e) => setShortBio(e.target.value)}
              maxLength={SHORT_BIO_MAX}
              rows={6}
              placeholder="Текст о вас для публичной страницы риэлтора"
              className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-50"
            />
            <p className="text-right text-xs text-gray-400">
              {shortBio.length}/{SHORT_BIO_MAX}
            </p>
          </div>

          <Button type="submit" disabled={saving || upload.state.busy}>
            {saving || upload.state.busy ? "Сохранение…" : "Сохранить"}
          </Button>
        </form>
      )}
    </>
  );
}
