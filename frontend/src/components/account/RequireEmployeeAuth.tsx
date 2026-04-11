"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authBearerHeaders, clearCrmTokens, getCrmAccessToken } from "@/lib/crmAuth";
import type { EmployeeUser } from "@/lib/employeeUser";
import { EmployeeUserProvider } from "@/components/account/EmployeeAuthContext";

function parseEmployeeUser(data: unknown): EmployeeUser | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (typeof o.id !== "number" || typeof o.email !== "string" || typeof o.role !== "string") {
    return null;
  }
  return {
    id: o.id,
    email: o.email,
    first_name: typeof o.first_name === "string" ? o.first_name : "",
    last_name: typeof o.last_name === "string" ? o.last_name : "",
    role: o.role,
    is_active: Boolean(o.is_active),
    is_staff: Boolean(o.is_staff),
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
        const res = await fetch("/api/auth/me/", { headers: authBearerHeaders() });
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
    return <p className="mt-6 text-sm text-gray-600">Загрузка…</p>;
  }
  if (state === "redirect") {
    return <p className="mt-6 text-sm text-gray-600">Перенаправление…</p>;
  }
  if (state === "session_error") {
    return (
      <div className="mt-6 space-y-3">
        <p className="text-sm text-gray-600">
          Не удалось проверить сессию. Проверьте соединение или обновите страницу.
        </p>
        <button
          type="button"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-50"
          onClick={() => window.location.reload()}
        >
          Обновить
        </button>
      </div>
    );
  }
  if (!user) {
    return <p className="mt-6 text-sm text-gray-600">Загрузка…</p>;
  }

  return <EmployeeUserProvider user={user}>{children}</EmployeeUserProvider>;
}
