"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { performEmployeeLogout } from "@/lib/crmAuth";
import {
  employeeRoleLabelRu,
  formatEmployeeCabinetDisplayName,
  isCabinetAdminRole,
  roleGetsUnreadIndicator,
} from "@/lib/employeeUser";
import {
  configureCrmUnread,
  formatUnreadBadge,
  useCrmUnreadCounts,
} from "@/lib/crmUnreadCounts";
import { useEmployeeUser } from "@/components/account/EmployeeAuthContext";
import { CrmNotifySoundToggle } from "@/components/account/CrmNotifySoundToggle";
import { Icon, Icons } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Боковое меню кабинета — по утверждённому макету `docs/design/Realtor
 * Dashboard.html`.
 *
 * ⚠ МАКЕТ РИСОВАЛСЯ БЕЗ ШАПКИ САЙТА. В нём `aside` — это
 * `position: fixed; top: 0; bottom: 0`, то есть колонка во всю высоту окна.
 * На реальных страницах кабинета шапка сайта ЕСТЬ (`SiteChrome` убирает её
 * только на `/account/login`) и она сама `sticky top-0 z-[1000]`, высотой
 * `--header-h`. `fixed; top: 0` накрыл бы её целиком. Поэтому колонка здесь
 * `sticky` с отступом на высоту шапки: поведение макета (меню стоит на месте,
 * пока прокручивается контент) сохранено, шапка не перекрыта.
 *
 * ⚠ ЦВЕТА — ТОЛЬКО ТОКЕНЫ. Макет использует тёплый серый текстовый ряд
 * (#3B3833 / #6B6560 / #8E877E / #9A9289), а в системе нейтральный ряд
 * холодный (--color-fg / -secondary / -muted). Свой оттенок здесь не заводится:
 * это была бы вторая нейтральная шкала в проекте. Расхождение описано в отчёте.
 */

/** `unread` называет ПОТОК счётчика, к которому привязан пункт меню. Ключ, а не
    число: сами числа приходят из общего хранилища опроса. */
type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  unread?: "inquiries" | "sale_requests";
};

const NAV_ITEMS: NavItem[] = [
  { href: "/account", label: "Панель", icon: Icons.Dashboard },
  { href: "/account/properties", label: "Объекты", icon: Icons.Apartment },
  {
    href: "/account/inquiries",
    label: "Заявки",
    icon: Icons.Inbox,
    unread: "inquiries",
  },
  {
    href: "/account/sale-requests",
    label: "Заявки на продажу",
    icon: Icons.SaleRequest,
    unread: "sale_requests",
  },
  { href: "/account/owners", label: "Собственники", icon: Icons.Owners },
  { href: "/account/profile", label: "Профиль", icon: Icons.User },
  {
    href: "/account/staff",
    label: "Сотрудники",
    icon: Icons.Owners,
    adminOnly: true,
  },
  {
    href: "/account/activity-logs",
    label: "Журнал активности",
    icon: Icons.Clock,
    adminOnly: true,
  },
];

export function AccountSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useEmployeeUser();
  const showAdminNav = isCabinetAdminRole(user.role);
  const showUnread = roleGetsUnreadIndicator(user.role);
  const { counts } = useCrmUnreadCounts();

  /* Шапка тоже настраивает хранилище из своего /api/auth/me/. Дублирование
     безобидно — configureCrmUnread идемпотентна, — а нужно оно затем, что
     переключатель звука меняет user В КОНТЕКСТЕ кабинета, и хранилище должно
     узнать об этом здесь, не дожидаясь, пока шапка перечитает профиль. */
  useEffect(() => {
    configureCrmUnread({
      isRealtor: showUnread,
      soundEnabled: user.crm_notify_sound_enabled,
    });
  }, [showUnread, user.crm_notify_sound_enabled]);

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
    <aside
      className={cn(
        "rounded-2xl border border-border bg-surface-raised px-4 pb-5 pt-6 shadow-xs",
        /* Липкая колонка вместо `fixed` из макета — см. заголовок файла.
           Отступ считается от токена высоты шапки, а не от числа, чтобы
           компактная/обычная шапка не разъезжались с этим значением. */
        "md:sticky md:top-[calc(var(--header-h)+16px)] md:max-h-[calc(100vh-var(--header-h)-32px)] md:overflow-y-auto",
        "flex flex-col",
      )}
    >
      <p className="px-2 text-caption font-semibold uppercase tracking-[0.1em] text-fg-muted">
        Личный кабинет
      </p>

      <div className="mt-4 flex flex-col gap-2.5 px-2 pb-3.5 pt-3">
        <div className="flex items-center gap-3">
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- Django media URL
            <img
              src={user.avatar as string}
              alt=""
              className="h-11 w-11 shrink-0 rounded-full border border-border object-cover"
            />
          ) : (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface-inset text-caption font-semibold text-fg-secondary"
              aria-hidden
            >
              {initials}
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-small font-semibold leading-tight text-fg">
              {displayName}
            </p>
            <p className="text-caption font-normal leading-tight text-fg-muted">
              {roleRu}
            </p>
          </div>
        </div>
        {/*
          ⚠ `break-words` (overflow-wrap: anywhere в макете), НЕ `truncate`.
          Прежняя вёрстка обрезала адрес многоточием — «79288497980@yan…» — и
          при 208px колонки это было видно на каждой странице `[measured]`.
          Почта риэлтора здесь единственная её запись на экране; она обязана
          читаться целиком, а перенос длинной строки дешевле, чем потеря конца.
        */}
        <p className="flex items-start gap-2 text-caption leading-snug text-fg-muted">
          <Icon
            icon={Icons.Mail}
            size={16}
            className="mt-px shrink-0 text-fg-muted"
          />
          <span className="min-w-0 break-words">{user.email}</span>
        </p>
      </div>

      <nav className="mt-3 flex flex-col gap-0.5" aria-label="Разделы кабинета">
        {visible.map((item) => {
          const active =
            item.href === "/account"
              ? pathname === "/account"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          /* Ноль непрочитанных — бейджа НЕТ, а не бейдж с нулём. `counts === null`
             («ещё не знаем») ведёт себя так же, поэтому на первой отрисовке
             ничего не мигает. */
          const unread =
            showUnread && item.unread && counts ? counts[item.unread] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-lg px-3 text-small transition-colors",
                "focus-ring-brand",
                active
                  ? "bg-brand-tint font-semibold text-brand"
                  : "font-medium text-fg-secondary hover:bg-surface-inset hover:text-fg",
              )}
            >
              {/*
                Вертикальная метка активного пункта из макета — но ВНУТРИ
                плашки, а не у края колонки.
                ⚠ В макете `aside` — колонка во всю высоту без скруглений, и
                полоска стоит на её ребре (`left: -16px` гасит padding). Здесь
                колонка оформлена карточкой со скруглением и рамкой, и та же
                `-left-4` выносила полоску НА рамку: получался оторванный
                штрих в 16px от пункта, читавшийся как артефакт, а не как
                маркер `[measured]`. У левого края самой плашки маркер значит
                ровно то же и выглядит намеренным.
              */}
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand"
                />
              )}
              <Icon
                icon={item.icon}
                size={20}
                className={cn(
                  "shrink-0",
                  active ? "text-brand" : "text-fg-muted",
                )}
              />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {unread > 0 && (
                <span
                  className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-none text-fg-inverse"
                  aria-label={`Непрочитанных: ${unread}`}
                >
                  {formatUnreadBadge(unread)}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Переключатель звука стоит сразу под пунктами, которые он озвучивает,
          и только у тех, кому вообще положены уведомления. */}
      {showUnread && (
        <>
          <div className="mx-1 mt-5 h-px bg-surface-inset" />
          <CrmNotifySoundToggle />
        </>
      )}

      {/* Распорка макета: «Выйти» прижат к низу колонки, когда место есть, и
          не наезжает на меню, когда его нет. */}
      <div className="min-h-6 flex-1" />

      <button
        type="button"
        onClick={logout}
        className={cn(
          "mt-4 flex h-11 items-center justify-center gap-2 rounded-lg",
          "border border-border-strong bg-surface-raised px-3 text-small font-semibold text-fg-secondary",
          "transition-colors hover:bg-surface hover:text-fg focus-ring-brand",
        )}
      >
        <Icon icon={Icons.Logout} size={16} className="shrink-0" />
        <span>Выйти</span>
      </button>
    </aside>
  );
}
