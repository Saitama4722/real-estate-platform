"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { authBearerHeaders, clearCrmTokens, getCrmAccessToken, performEmployeeLogout } from "@/lib/crmAuth";

interface MeUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export function CrmDashboardPanel() {
  const [user, setUser] = useState<MeUser | null | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getCrmAccessToken();
    if (!token) {
      setUser(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me/", { headers: authBearerHeaders() });
        if (res.status === 401) {
          clearCrmTokens();
          if (!cancelled) setUser(null);
          return;
        }
        if (!res.ok) {
          console.error("[CrmDashboardPanel] /me HTTP", res.status);
          if (!cancelled) setError("Не удалось загрузить профиль.");
          return;
        }
        const data = (await res.json()) as MeUser;
        if (!cancelled) {
          setUser(data);
          setError("");
        }
      } catch (e) {
        console.error("[CrmDashboardPanel] /me", e);
        if (!cancelled) setError("Ошибка соединения.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = async () => {
    await performEmployeeLogout();
    setUser(null);
  };

  if (user === undefined) {
    return <p className="mt-6 text-sm text-gray-600">Загрузка…</p>;
  }

  if (user === null) {
    return (
      <div className="mt-6 space-y-4">
        <p className="text-sm text-gray-600">Войдите, чтобы работать с CRM.</p>
        <Link
          href="/account/login"
          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
        >
          Перейти ко входу
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-xs text-gray-500">Текущий пользователь</p>
        <p className="mt-1 font-medium text-gray-900">{user.email}</p>
        <p className="mt-1 text-sm text-gray-600">
          Роль: <span className="font-mono text-xs">{user.role}</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/crm/properties"
          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
        >
          Объекты
        </Link>
        <Link
          href="/crm/leads"
          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
        >
          Лиды
        </Link>
        <Link
          href="/crm/articles"
          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
        >
          Статьи
        </Link>
        <Link
          href="/crm/users"
          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
        >
          Пользователи
        </Link>
        <Button variant="outline" onClick={logout}>
          Выйти
        </Button>
      </div>
    </div>
  );
}
