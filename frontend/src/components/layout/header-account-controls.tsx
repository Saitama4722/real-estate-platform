"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  authBearerHeaders,
  getCrmAccessToken,
  refreshCrmAccessToken,
} from "@/lib/crmAuth";
import { CRM_ACCESS_LS_KEY, employeeAuthAbsoluteUrl } from "@/lib/crmAuthConstants";
import {
  formatEmployeeCabinetDisplayName,
  parseEmployeeUser,
  type EmployeeUser,
} from "@/lib/employeeUser";
import { cn } from "@/lib/utils";

export function HeaderAccountControls() {
  const pathname = usePathname();
  const [user, setUser] = useState<EmployeeUser | null>(null);
  const [ready, setReady] = useState(false);

  const loadMe = useCallback(async () => {
    const token = getCrmAccessToken();
    if (!token?.trim()) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      const fetchMe = () =>
        fetch(employeeAuthAbsoluteUrl("me"), { headers: authBearerHeaders() });
      let res = await fetchMe();
      if (res.status === 401) {
        if (await refreshCrmAccessToken()) res = await fetchMe();
      }
      if (res.status === 401 || !res.ok) {
        setUser(null);
        setReady(true);
        return;
      }
      const raw = await res.json().catch(() => null);
      setUser(parseEmployeeUser(raw));
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe, pathname]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CRM_ACCESS_LS_KEY || e.key === null) void loadMe();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [loadMe]);

  if (!ready) {
    return (
      <div className="h-9 w-28 animate-pulse rounded-md bg-gray-100" aria-hidden />
    );
  }

  if (!user) {
    return (
      <Link
        href="/account/login"
        className={cn(
          "inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 transition-colors",
          "hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
        )}
      >
        Вход в личный кабинет
      </Link>
    );
  }

  const displayName = formatEmployeeCabinetDisplayName(user);
  const hasPhoto = typeof user.avatar === "string" && user.avatar.length > 0;
  const initials = (() => {
    const a = (user.first_name ?? "").trim().charAt(0);
    const b = (user.last_name ?? "").trim().charAt(0);
    if (a && b) return (a + b).toUpperCase();
    if (a) return a.toUpperCase();
    if (b) return b.toUpperCase();
    const e = user.email.trim().charAt(0);
    return e ? e.toUpperCase() : "?";
  })();

  return (
    <Link
      href="/account"
      className="inline-flex max-w-[min(20rem,45vw)] items-center gap-2.5 rounded-md border border-gray-200 bg-white py-1.5 pl-1.5 pr-3 text-left text-sm text-gray-900 transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- external or media URL from API
        <img
          src={user.avatar as string}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-gray-200"
        />
      ) : (
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 ring-1 ring-gray-200"
          aria-hidden
        >
          {initials}
        </div>
      )}
      <span className="min-w-0 truncate font-medium" title={displayName}>
        {displayName}
      </span>
    </Link>
  );
}
