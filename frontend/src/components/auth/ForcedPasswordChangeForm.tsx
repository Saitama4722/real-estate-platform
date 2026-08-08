"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon, Icons } from "@/components/ui/icon";
import { setCrmTokens, authBearerHeaders, clearCrmTokens } from "@/lib/crmAuth";
import { employeeAuthAbsoluteUrl } from "@/lib/crmAuthConstants";
import { cn } from "@/lib/utils";

/**
 * Right-hand panel of the auth shell for a forced password change.
 *
 * This is the payoff for building AuthShell as a shared surface: the screen is
 * just this panel — the brand side, the responsive band and the field styling
 * all come for free.
 *
 * The employee lands here after signing in with a password the superadmin
 * chose. Until they replace it the API refuses the whole CRM
 * (VersionedJWTAuthentication), so this is not merely advisory.
 */

const TIERS = [
  { label: "Слабый", bar: "bg-danger", text: "text-danger" },
  { label: "Средний", bar: "bg-warning", text: "text-warning" },
  { label: "Хороший", bar: "bg-brand", text: "text-brand" },
  { label: "Надёжный", bar: "bg-success", text: "text-success" },
] as const;

/** Mirrors the mockup's §04 meter. Advisory only — Django validates for real. */
function strength(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-zа-я]/.test(pw) && /[A-ZА-Я]/.test(pw)) score += 1;
  if (/\d/.test(pw) && /[^\wА-Яа-я]/.test(pw)) score += 1;
  return Math.min(score, 4);
}

export function ForcedPasswordChangeForm() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const score = strength(next);
  const tier = next ? TIERS[Math.max(0, score - 1)] : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (next !== confirm) {
      setErrors(["Пароли не совпадают."]);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      const res = await fetch(employeeAuthAbsoluteUrl("password-change"), {
        method: "POST",
        headers: { ...authBearerHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        const msgs: string[] = [];
        for (const key of ["new_password", "current_password", "detail"]) {
          const v = data[key];
          if (Array.isArray(v)) msgs.push(...(v as string[]));
          else if (typeof v === "string") msgs.push(v);
        }
        setErrors(msgs.length ? msgs : ["Не удалось изменить пароль."]);
        return;
      }
      // The server bumped token_version, so the tokens we arrived with are
      // already dead. It hands back a fresh pair — store it or the next
      // request 401s and the user is bounced to the login screen.
      if (typeof data.access === "string" && typeof data.refresh === "string") {
        setCrmTokens(data.access, data.refresh);
      } else {
        clearCrmTokens();
        router.replace("/account/login");
        return;
      }
      router.replace("/account");
      router.refresh();
    } catch {
      setErrors(["Ошибка соединения. Попробуйте позже."]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      <h1 className="m-0 text-[clamp(25px,3vw,32px)] leading-[1.15] font-bold tracking-[-0.025em] text-fg">
        Задайте новый пароль
      </h1>
      <p className="mt-2 mb-8 text-[15px] leading-[1.5] text-fg-secondary">
        Текущий пароль выдан администратором. Замените его — до этого доступ к
        CRM закрыт.
      </p>

      {errors.length > 0 && (
        <div
          role="alert"
          tabIndex={-1}
          className="mb-6 flex gap-3 rounded-[10px] border border-red-200 bg-red-50 p-4"
        >
          <Icon icon={Icons.Alert} size={20} className="mt-px shrink-0 text-danger" />
          <ul className="text-[13px] leading-[1.45] text-red-900">
            {errors.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <label htmlFor="fp-current" className="ctr-auth-label mb-2">
        Текущий пароль
      </label>
      <input
        id="fp-current"
        name="current-password"
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        disabled={saving}
        className="ctr-auth-control"
      />

      <label htmlFor="fp-new" className="ctr-auth-label mt-[22px] mb-2">
        Новый пароль
      </label>
      <input
        id="fp-new"
        name="new-password"
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        disabled={saving}
        className="ctr-auth-control"
      />
      <div aria-hidden="true" className="mt-3 flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-sm",
              tier && i < score ? tier.bar : "bg-border",
            )}
          />
        ))}
      </div>
      <p
        className={cn(
          "mt-2 text-caption font-medium",
          tier ? tier.text : "text-fg-muted",
        )}
      >
        {tier ? tier.label : "Введите пароль"}
      </p>

      <label htmlFor="fp-confirm" className="ctr-auth-label mt-[22px] mb-2">
        Повторите пароль
      </label>
      <input
        id="fp-confirm"
        name="new-password-confirm"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        disabled={saving}
        className="ctr-auth-control"
      />

      <div aria-hidden="true" className="h-8" />

      <button
        type="submit"
        disabled={saving || !current || !next || !confirm}
        className="ctr-auth-submit"
      >
        {saving ? "Сохраняем…" : "Сохранить и войти"}
      </button>
    </form>
  );
}
