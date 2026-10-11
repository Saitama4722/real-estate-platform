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
import { parseEmployeeUser, type EmployeeUser } from "@/lib/employeeUser";
import { EmployeeUserProvider } from "@/components/account/EmployeeAuthContext";

import { usePageLoading } from "@/components/layout/pageLoadingSignal";

export function RequireEmployeeAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ok" | "redirect" | "session_error">("checking");
  const [user, setUser] = useState<EmployeeUser | null>(null);

  /* Holds the global navigation indicator until the content the user
     navigated for is really on screen. A skeleton is not a loaded page.
     See components/layout/pageLoadingSignal.ts. This is the FIRST of two stages for every cabinet route: the auth
     check renders skeletons before any page data is even requested. */
  usePageLoading(state === "checking");

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
        // An employee still holding an admin-issued password is sent to set
        // their own. Typing a cabinet URL directly lands here too, so there is
        // no way round it — and the API refuses everything regardless, so this
        // is convenience rather than the enforcement.
        if (
          (raw as { must_change_password?: boolean } | null)
            ?.must_change_password
        ) {
          if (!cancelled) router.replace("/account/change-password");
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
    /**
     * ⚠ ЗАГЛУШКА ПОВТОРЯЕТ ГЕОМЕТРИЮ КАБИНЕТА, А НЕ НАМЕКАЕТ НА НЕЁ.
     *
     * Это не украшение: пока состояние `checking`, страница ЗАНИМАЕТ место, и
     * если места меньше, чем у настоящего содержимого, при подстановке всё
     * ниже прыгает. Прежняя заглушка резервировала колонку 208px и высоту
     * 176px против фактических 280px и 634px — и загрузка «Панели» давала
     * сдвиг макета CLS 0.617 на 375px и 0.061 на 1440px `[measured]`.
     *
     * ⚠ Высота НЕ ЗАДАНА ЧИСЛОМ. Строки набраны теми же классами, что и
     * настоящие (`h-11`, те же отступы и та же рамка), поэтому колонка-скелет
     * высчитывает свою высоту сама и не разъедется с меню, если у пункта
     * поменяется высота. Магическое число здесь протухло бы первым.
     */
    return (
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        <div className="md:w-[280px] md:shrink-0">
          <div
            className="flex flex-col rounded-2xl border border-border bg-surface-raised px-4 pb-5 pt-6 shadow-xs"
            aria-hidden
          >
            <div className="ctr-skel mx-2 h-4 w-32 rounded" />
            <div className="mt-4 flex flex-col gap-2.5 px-2 pb-3.5 pt-3">
              <div className="flex items-center gap-3">
                <div className="ctr-skel h-11 w-11 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="ctr-skel h-4 w-4/5 rounded" />
                  <div className="ctr-skel h-3 w-2/5 rounded" />
                </div>
              </div>
              <div className="ctr-skel h-4 w-full rounded" />
            </div>
            <div className="mt-3 flex flex-col gap-0.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="ctr-skel h-11 rounded-lg" />
              ))}
            </div>
            <div className="mx-1 mt-5 h-px bg-surface-inset" />
            <div className="ctr-skel mt-4 h-11 rounded-xl" />
            <div className="min-h-6 flex-1" />
            <div className="ctr-skel mt-4 h-11 rounded-lg" />
          </div>
        </div>
        <div className="min-w-0 flex-1" aria-hidden>
          <div className="max-w-[660px]">
            <div className="border-b border-border pb-6">
              <div className="ctr-skel h-9 w-48 rounded-lg" />
              <div className="ctr-skel mt-2.5 h-5 w-72 max-w-full rounded" />
            </div>
            <div className="ctr-skel mt-8 h-[266px] rounded-2xl" />
            <div className="ctr-skel mt-6 h-5 w-80 max-w-full rounded" />
          </div>
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

  return <EmployeeUserProvider user={user} setUser={setUser}>{children}</EmployeeUserProvider>;
}
