"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { clearCrmTokens } from "@/lib/crmAuth";
import { isCabinetAdminRole } from "@/lib/employeeUser";
import { useEmployeeUser } from "@/components/account/EmployeeAuthContext";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; adminOnly?: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: "/account", label: "Панель" },
  { href: "/account/properties", label: "Объекты" },
  { href: "/account/clients", label: "Клиенты" },
  { href: "/account/profile", label: "Профиль" },
  { href: "/account/staff", label: "Сотрудники", adminOnly: true },
];

export function AccountSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useEmployeeUser();
  const showAdminNav = isCabinetAdminRole(user.role);

  const visible = NAV_ITEMS.filter((item) => !item.adminOnly || showAdminNav);

  const logout = () => {
    clearCrmTokens();
    router.replace("/account/login");
    router.refresh();
  };

  return (
    <aside className="w-full shrink-0 border-b border-slate-200 pb-6 md:w-52 md:border-b-0 md:border-r md:pb-0 md:pr-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Личный кабинет</p>
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
