"use client";

import { useEmployeeUser } from "@/components/account/EmployeeAuthContext";
import {
  employeeRoleLabelRu,
  formatEmployeeCabinetDisplayName,
} from "@/lib/employeeUser";
import { Icon, Icons } from "@/components/ui/icon";
import { formatPhoneParens, telHref } from "@/lib/phoneFormat";

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

/**
 * Карточка текущего сотрудника на «Панели» — по макету `docs/design/Realtor
 * Dashboard.html`.
 *
 * Что изменилось против прежней версии, кроме размеров: роль вынесена в чип
 * рядом с именем (была строкой под ним), контакты отделены разделителем и
 * получили иконки, почта стала ссылкой `mailto:`, а телефон — форматированным
 * и с табличными цифрами.
 */
export function AccountDashboardUserSummary() {
  const user = useEmployeeUser();
  const displayName = formatEmployeeCabinetDisplayName(user);
  const roleRu = employeeRoleLabelRu(user.role);
  const phone = user.phone?.trim();
  const hasPhoto = typeof user.avatar === "string" && user.avatar.length > 0;

  return (
    <section
      className="rounded-2xl border border-border bg-surface-raised p-8 shadow-xs"
      aria-labelledby="account-dashboard-user-heading"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        {hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar URL comes from Django media (dynamic host)
          <img
            src={user.avatar as string}
            alt=""
            className="h-24 w-24 shrink-0 rounded-full border border-border object-cover"
          />
        ) : (
          <div
            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-border bg-surface-inset text-h3 font-semibold text-fg-secondary"
            aria-hidden
          >
            {displayInitials(user)}
          </div>
        )}
        <div className="flex min-w-0 flex-col items-start gap-2.5">
          <h2
            id="account-dashboard-user-heading"
            className="text-h2 leading-tight text-fg"
          >
            {displayName}
          </h2>
          <span className="inline-block rounded-full border border-border bg-surface px-3 py-1 text-caption font-semibold text-fg-secondary">
            {roleRu}
          </span>
        </div>
      </div>

      <div className="mt-7 h-px bg-surface-inset" />

      <dl className="mt-6 grid gap-4">
        <div className="flex items-center gap-3">
          <dt className="flex shrink-0 items-center">
            <Icon icon={Icons.Mail} size={20} className="text-fg-muted" />
            <span className="sr-only">Почта</span>
          </dt>
          {/* `break-words`, не `truncate`: адрес длинный, и обрезать его
              многоточием в карточке, где он единственная контактная строка,
              значит потерять то, ради чего карточка и существует. */}
          <dd className="min-w-0 break-words text-body text-brand">
            <a href={`mailto:${user.email}`} className="hover:underline">
              {user.email}
            </a>
          </dd>
        </div>
        {phone ? (
          <div className="flex items-center gap-3">
            <dt className="flex shrink-0 items-center">
              <Icon icon={Icons.Phone} size={20} className="text-fg-muted" />
              <span className="sr-only">Телефон</span>
            </dt>
            {/* Табличные цифры — тот же приём, что у цен: номер не «пляшет».
                `formatPhoneParens` — скобочная форма «+7 (928) 333-08-37»,
                та же, что в шапке сайта и в макете. */}
            <dd className="min-w-0 text-body tabular-nums text-fg">
              <a href={telHref(phone)} className="hover:underline">
                {formatPhoneParens(phone)}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
