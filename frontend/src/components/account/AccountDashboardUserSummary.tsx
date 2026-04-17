"use client";

import { useEmployeeUser } from "@/components/account/EmployeeAuthContext";
import {
  employeeRoleLabelRu,
  formatEmployeeCabinetDisplayName,
} from "@/lib/employeeUser";

function displayInitials(user: {
  first_name: string;
  last_name: string;
  email: string;
}): string {
  const a = user.first_name.trim().charAt(0);
  const b = user.last_name.trim().charAt(0);
  if (a && b) return (a + b).toUpperCase();
  if (a) return a.toUpperCase();
  if (b) return b.toUpperCase();
  const e = user.email.trim().charAt(0);
  return e ? e.toUpperCase() : "?";
}

export function AccountDashboardUserSummary() {
  const user = useEmployeeUser();
  const displayName = formatEmployeeCabinetDisplayName(user);
  const roleRu = employeeRoleLabelRu(user.role);
  const phone = user.phone?.trim();
  const hasPhoto = typeof user.avatar === "string" && user.avatar.length > 0;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100"
      aria-labelledby="account-dashboard-user-heading"
    >
      <h2 id="account-dashboard-user-heading" className="sr-only">
        Текущий пользователь
      </h2>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="shrink-0">
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar URL comes from Django media (dynamic host)
            <img
              src={user.avatar as string}
              alt=""
              className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-100"
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-xl font-semibold text-slate-700 ring-2 ring-slate-100"
              aria-hidden
            >
              {displayInitials(user)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-lg font-semibold text-slate-900">{displayName}</p>
          <p className="text-sm text-slate-600">{roleRu}</p>
          <p className="truncate text-sm text-slate-500" title={user.email}>
            {user.email}
          </p>
          {phone ? (
            <p className="text-sm text-slate-600">
              <span className="text-slate-500">Тел.: </span>
              {phone}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
