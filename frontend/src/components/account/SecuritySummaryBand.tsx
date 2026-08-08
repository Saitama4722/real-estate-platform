"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchWithCrmAuthRetry } from "@/lib/crmAuth";

/**
 * Superadmin-only security band on the cabinet dashboard.
 *
 * ⚠ RENDERS NOTHING WHEN ALL THREE NUMBERS ARE ZERO — that is the whole design.
 * With dozens of realtors, sorting a log by recency stops working as a signal:
 * nobody scans rows. An aggregate does not grow with headcount, silence is the
 * normal state, so the band APPEARING is itself the alert.
 *
 * This is deliberately not a monitoring system: no thresholds, no history, no
 * charts, no email. Three numbers and the accounts that are actually locked.
 */

interface LockedRow {
  id: number;
  crm_id: string;
  email: string;
  locked_until: string;
  failed_login_count: number;
}

interface Summary {
  window_hours: number;
  failed_attempts: number;
  accounts_targeted: number;
  locked: LockedRow[];
}

function pluralAttempts(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "неудачная попытка входа";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return "неудачные попытки входа";
  return "неудачных попыток входа";
}

function pluralAccounts(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "аккаунту";
  return "аккаунтам";
}

export function SecuritySummaryBand() {
  const [data, setData] = useState<Summary | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchWithCrmAuthRetry("/api/auth/security-summary/", {
        credentials: "same-origin",
      });
      // 403 simply means "not the superadmin" — stay silent, never error.
      if (!res.ok) return;
      setData((await res.json()) as Summary);
    } catch {
      /* a dashboard extra must never break the dashboard */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unlock = async (row: LockedRow) => {
    setBusy(row.id);
    try {
      const res = await fetchWithCrmAuthRetry(
        `/api/crm/realtors/${row.id}/unlock/`,
        { method: "POST", credentials: "same-origin" },
      );
      if (res.ok) await load();
    } finally {
      setBusy(null);
    }
  };

  if (!data) return null;
  const quiet =
    data.failed_attempts === 0 &&
    data.accounts_targeted === 0 &&
    data.locked.length === 0;
  if (quiet) return null;

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">Безопасность входа</p>
      <p className="mt-1 text-sm text-amber-900">
        За {data.window_hours} часа: {data.failed_attempts}{" "}
        {pluralAttempts(data.failed_attempts)} по {data.accounts_targeted}{" "}
        {pluralAccounts(data.accounts_targeted)}
        {data.locked.length > 0 && `, заблокировано: ${data.locked.length}`}.
      </p>

      {data.locked.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {data.locked.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2"
            >
              <span className="text-sm text-amber-900">
                {row.crm_id} · {row.email}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy === row.id}
                onClick={() => void unlock(row)}
              >
                {busy === row.id ? "…" : "Разблокировать"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/account/activity-logs?action_type=login_failed"
        className="mt-3 inline-block text-sm font-medium text-amber-900 underline underline-offset-2"
      >
        Открыть журнал
      </Link>
    </div>
  );
}
