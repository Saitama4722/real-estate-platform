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
import { ButtonLink } from "@/components/ui/button-link";
import { Icons } from "@/components/ui/icon";

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
      <div className="h-8 w-28 animate-pulse rounded-lg bg-gray-100" aria-hidden />
    );
  }

  if (!user) {
    return (
      <ButtonLink
        href="/account/login"
        variant="outline"
        size="sm"
        icon={Icons.User}
      >
        {/* The full label makes the header row's intrinsic width 375px — ButtonLink
            is whitespace-nowrap, so at a 360px viewport EVERY page grew a
            horizontal scrollbar `[measured]` (scrollWidth 375, all four swept
            pages identically). Below 400px only «Вход» renders; from 400px up
            the header is pixel-identical to before. The logged-in chip never
            had this problem — it already truncates via max-w. */}
        {/* One outer span, so the label stays a SINGLE flex item inside the
            button — bare text + a sibling span would become two items with the
            button's gap-2 between them, changing ≥400px spacing. */}
        <span>
          Вход
          <span className="hidden min-[400px]:inline">&nbsp;в личный кабинет</span>
        </span>
      </ButtonLink>
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
      className="inline-flex max-w-[min(20rem,45vw)] items-center gap-2.5 rounded-lg border border-border bg-surface-raised py-1.5 pl-1.5 pr-3 text-left text-sm text-fg transition-colors duration-150 hover:border-border-strong hover:bg-gray-50"
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
