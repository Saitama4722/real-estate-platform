"use client";

import { useCallback, useEffect, useState } from "react";
import { useEmployeeUser } from "@/components/account/EmployeeAuthContext";
import { usePageLoading } from "@/components/layout/pageLoadingSignal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchWithCrmAuthRetry } from "@/lib/crmAuth";
import { AGENCY_PHONE_BLOCK_KEY } from "@/lib/homepageTextBlocks";
import { formatPhoneParens } from "@/lib/phoneFormat";

/**
 * Site-wide contact settings. Today that is exactly one value — the agency
 * phone shown in the site header.
 *
 * ⚠ WHY IT LIVES ON /account/staff: this project has NO site-settings page, and
 * the only other place a site value can be edited is Django admin (which the
 * owner does not use) or inline on the homepage (wrong surface — the header is
 * on every page and this is not homepage copy). /account/staff is the existing
 * superadmin-scoped cabinet page, so the panel needed no new route and no new
 * sidebar entry. Move it to a dedicated «Настройки сайта» page as soon as a
 * SECOND site-level setting exists — one field does not justify a route.
 *
 * The panel renders NOTHING for a non-superadmin. That mirrors the API, which
 * is the real gate (403); this only avoids showing a control that would fail.
 */
export function AccountSiteContactsPanel() {
  const user = useEmployeeUser();
  const isSuperadmin = user.role === "superadmin";

  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  usePageLoading(isSuperadmin && loading);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/homepage/text-blocks/", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { blocks?: { key: string; value: string }[] };
      const row = (data.blocks ?? []).find((b) => b.key === AGENCY_PHONE_BLOCK_KEY);
      const value = (row?.value ?? "").trim();
      setSaved(value);
      setDraft(value ? formatPhoneParens(value) : "");
    } catch (e) {
      console.error("[AccountSiteContactsPanel] load", e);
      setError("Не удалось загрузить текущий телефон.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSuperadmin) {
      setLoading(false);
      return;
    }
    void load();
  }, [isSuperadmin, load]);

  if (!isSuperadmin) return null;

  const save = async () => {
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      // ⚠ The path MUST start with `/api/` — `crmBrowserApiUrl` returns
      // anything else UNCHANGED, so a shorter path silently hits the Next.js
      // app instead of Django and comes back as 404 HTML.
      const res = await fetchWithCrmAuthRetry(
        `/api/crm/homepage/text-blocks/${AGENCY_PHONE_BLOCK_KEY}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: draft }),
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        // The backend owns the wording — never restate a validation message
        // here, or the two drift.
        const detail =
          (body?.value && Array.isArray(body.value) ? body.value[0] : null) ??
          body?.detail ??
          "Не удалось сохранить телефон.";
        setError(String(detail));
        return;
      }
      const value = String(body?.value ?? "").trim();
      setSaved(value);
      setDraft(value ? formatPhoneParens(value) : "");
      setOk(true);
    } catch (e) {
      console.error("[AccountSiteContactsPanel] save", e);
      setError("Не удалось сохранить телефон.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-10 rounded-xl border border-border bg-surface-raised p-5">
      <h2 className="text-lg font-semibold text-fg">Контакты сайта</h2>
      <p className="mt-1 text-sm text-fg-muted">
        Телефон агентства в шапке сайта. Пустое поле — телефон не показывается.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-sm font-medium text-fg-secondary">
            Телефон агентства
          </span>
          <Input
            value={draft}
            inputMode="tel"
            placeholder="+7 (928) 333-08-37"
            disabled={loading || saving}
            onChange={(e) => {
              setDraft(e.target.value);
              setOk(false);
              setError(null);
            }}
          />
        </label>
        <Button type="button" onClick={save} disabled={loading || saving}>
          {saving ? "Сохранение…" : "Сохранить"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-accent">
          {error}
        </p>
      )}
      {ok && !error && (
        <p className="mt-3 text-sm text-fg-secondary">
          {saved
            ? `Сохранено. В шапке: ${formatPhoneParens(saved)}`
            : "Сохранено. Телефон убран из шапки сайта."}
        </p>
      )}
      <p className="mt-3 text-xs text-fg-muted">
        Изменения появляются на сайте в течение минуты — страницы кэшируются на 60
        секунд.
      </p>
    </section>
  );
}
