"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchWithCrmAuthRetry } from "@/lib/crmAuth";

/**
 * Self-service change of the login email.
 *
 * ⚠ SEPARATE FROM THE PROFILE FORM ON PURPOSE. Email is the credential, so the
 * change is confirmed with the current password — mixing that into the form
 * that also edits name and phone would mean typing a password to fix a typo in
 * a phone number. The backend enforces the same rule (ChangeOwnEmailSerializer);
 * this is not a client-side-only gate.
 *
 * The password is held in component state only for the duration of the request
 * and cleared immediately after — never persisted, never logged, never in a URL.
 */

interface ChangeOwnEmailCardProps {
  currentEmail: string;
  onChanged: (email: string) => void;
}

export function ChangeOwnEmailCard({ currentEmail, onChanged }: ChangeOwnEmailCardProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setOpen(false);
    setEmail(currentEmail);
    setPassword("");
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetchWithCrmAuthRetry("/api/auth/me/email/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), current_password: password }),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = "Не удалось изменить email.";
        try {
          const j = JSON.parse(text) as Record<string, unknown>;
          if (Array.isArray(j.email)) msg = (j.email as string[]).join(" ");
          else if (Array.isArray(j.current_password))
            msg = (j.current_password as string[]).join(" ");
          else if (typeof j.detail === "string") msg = j.detail;
        } catch {
          /* keep the fallback */
        }
        setError(msg);
        return;
      }
      const data = (await res.json()) as { email?: string };
      const next = data.email ?? email.trim();
      onChanged(next);
      setDone(`Email изменён на ${next}. Используйте его для входа.`);
      setOpen(false);
      setPassword("");
    } catch {
      setError("Ошибка соединения. Попробуйте позже.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700">Email (логин)</p>
          <p className="text-sm text-slate-600">{currentEmail}</p>
        </div>
        {!open && (
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            Изменить
          </Button>
        )}
      </div>

      {done && !open && (
        <p role="status" className="mt-3 text-sm text-green-700">
          {done}
        </p>
      )}

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="space-y-1">
            <label htmlFor="own-email" className="block text-sm font-medium text-slate-700">
              Новый email
            </label>
            <Input
              id="own-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="own-email-password"
              className="block text-sm font-medium text-slate-700"
            >
              Текущий пароль
            </label>
            <Input
              id="own-email-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={saving}
            />
            <p className="text-xs text-slate-500">
              Email — это логин, поэтому смену подтверждаем паролем.
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={saving || !email.trim() || !password}
            >
              {saving ? "Сохранение…" : "Сохранить email"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={reset} disabled={saving}>
              Отмена
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
