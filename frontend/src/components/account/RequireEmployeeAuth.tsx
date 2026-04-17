"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  authBearerHeaders,
  clearCrmTokens,
  getCrmAccessToken,
  refreshCrmAccessToken,
} from "@/lib/crmAuth";
import { employeeAuthAbsoluteUrl } from "@/lib/crmAuthConstants";
import type { EmployeeCrmCapabilities, EmployeeUser } from "@/lib/employeeUser";
import { EmployeeUserProvider } from "@/components/account/EmployeeAuthContext";

function parseEmployeeUser(data: unknown): EmployeeUser | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (typeof o.id !== "number" || typeof o.email !== "string" || typeof o.role !== "string") {
    return null;
  }
  let crm_capabilities: EmployeeCrmCapabilities | undefined;
  const capsRaw = o.crm_capabilities;
  if (capsRaw && typeof capsRaw === "object") {
    const c = capsRaw as Record<string, unknown>;
    crm_capabilities = {
      create_property: Boolean(c.create_property),
      edit_property: Boolean(c.edit_property),
      delete_property: Boolean(c.delete_property),
      view_clients: Boolean(c.view_clients),
      delete_clients: Boolean(c.delete_clients),
      change_status: Boolean(c.change_status),
    };
  }
  return {
    id: o.id,
    email: o.email,
    first_name: typeof o.first_name === "string" ? o.first_name : "",
    last_name: typeof o.last_name === "string" ? o.last_name : "",
    phone: typeof o.phone === "string" ? o.phone : undefined,
    crm_id: typeof o.crm_id === "string" ? o.crm_id : undefined,
    avatar: typeof o.avatar === "string" ? o.avatar : null,
    role: o.role,
    is_active: Boolean(o.is_active),
    is_staff: Boolean(o.is_staff),
    crm_capabilities,
  };
}

export function RequireEmployeeAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ok" | "redirect" | "session_error">("checking");
  const [user, setUser] = useState<EmployeeUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = getCrmAccessToken();
      if (!token?.trim()) {
        clearCrmTokens();
        router.replace("/account/login");
        if (!cancelled) setState("redirect");
        return;
      }
      try {
        const fetchMe = () => fetch(employeeAuthAbsoluteUrl("me"), { headers: authBearerHeaders() });
        let res = await fetchMe();
        if (res.status === 401) {
          const refreshed = await refreshCrmAccessToken();
          if (refreshed) res = await fetchMe();
        }
        if (res.status === 401) {
          clearCrmTokens();
          router.replace("/account/login");
          if (!cancelled) setState("redirect");
          return;
        }
        if (!res.ok) {
          if (!cancelled) setState("session_error");
          return;
        }
        const raw = await res.json().catch(() => null);
        const me = parseEmployeeUser(raw);
        if (!me) {
          if (!cancelled) setState("session_error");
          return;
        }
        if (!cancelled) {
          setUser(me);
          setState("ok");
        }
      } catch {
        if (!cancelled) setState("session_error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === "checking") {
    return (
      <div className="mt-6 flex flex-col gap-8 md:flex-row md:gap-10">
        <div className="h-44 w-full shrink-0 animate-pulse rounded-xl bg-slate-200 md:w-52" aria-hidden />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="h-9 max-w-xs animate-pulse rounded-lg bg-slate-200" aria-hidden />
          <div className="h-4 max-w-lg animate-pulse rounded bg-slate-200" aria-hidden />
          <div className="h-4 max-w-md animate-pulse rounded bg-slate-200" aria-hidden />
        </div>
      </div>
    );
  }
  if (state === "redirect") {
    return <p className="mt-6 text-sm text-gray-600">Перенаправление…</p>;
  }
  if (state === "session_error") {
    return (
      <div className="mt-6 max-w-lg space-y-4 rounded-xl border border-amber-200 bg-amber-50/80 p-5">
        <p className="text-sm font-medium text-amber-950">
          Не удалось загрузить данные профиля (ошибка сети или сервера).
        </p>
        <p className="text-sm text-amber-900/90">
          Проверьте соединение. Если проблема повторяется, обновите страницу или войдите снова.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-amber-300/80 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-amber-50"
            onClick={() => window.location.reload()}
          >
            Обновить страницу
          </button>
          <button
            type="button"
            className="rounded-md border border-amber-300/80 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-amber-50"
            onClick={() => {
              clearCrmTokens();
              router.replace("/account/login");
            }}
          >
            Войти снова
          </button>
        </div>
      </div>
    );
  }
  if (!user) {
    return <p className="mt-6 text-sm text-gray-600">Загрузка…</p>;
  }

  return <EmployeeUserProvider user={user}>{children}</EmployeeUserProvider>;
}
