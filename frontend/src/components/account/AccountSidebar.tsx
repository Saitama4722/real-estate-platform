"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { performEmployeeLogout } from "@/lib/crmAuth";
import {
  employeeRoleLabelRu,
  formatEmployeeCabinetDisplayName,
  isCabinetAdminRole,
} from "@/lib/employeeUser";
import { useEmployeeUser } from "@/components/account/EmployeeAuthContext";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; adminOnly?: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: "/account", label: "Панель" },
  { href: "/account/properties", label: "Объекты" },
  { href: "/account/inquiries", label: "Заявки" },
  { href: "/account/profile", label: "Профиль" },
  { href: "/account/staff", label: "Сотрудники", adminOnly: true },
  { href: "/account/activity-logs", label: "Журнал активности", adminOnly: true },
];

export function AccountSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useEmployeeUser();
  const showAdminNav = isCabinetAdminRole(user.role);

  const visible = NAV_ITEMS.filter((item) => !item.adminOnly || showAdminNav);

  const displayName = formatEmployeeCabinetDisplayName(user);
  const roleRu = employeeRoleLabelRu(user.role);
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

  const logout = async () => {
    await performEmployeeLogout();
    router.replace("/account/login");
    router.refresh();
  };

  return (
    <aside className="w-full shrink-0 border-b border-slate-200 pb-6 md:w-52 md:border-b-0 md:border-r md:pb-0 md:pr-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Личный кабинет</p>
      <div className="mt-3 flex gap-3">
        <div className="shrink-0">
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- Django media URL
            <img
              src={user.avatar as string}
              alt=""
              className="h-11 w-11 rounded-full object-cover ring-1 ring-slate-200"
            />
          ) : (
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
              aria-hidden
            >
              {initials}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 break-words">{displayName}</p>
          <p className="mt-0.5 text-xs text-slate-600">{roleRu}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500" title={user.email}>
            {user.email}
          </p>
        </div>
      </div>
      <nav className="mt-4 flex flex-col gap-1" aria-label="Разделы кабинета">
        {visible.map((item) => {
          const active =
            item.href === "/account"
              ? pathname === "/account"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8 border-t border-slate-200 pt-6">
        <Button type="button" variant="outline" className="w-full" onClick={logout}>
          Выйти
        </Button>
      </div>
    </aside>
  );
}
