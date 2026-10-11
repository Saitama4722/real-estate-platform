import Link from "next/link";
import { AccountDashboardUserSummary } from "@/components/account/AccountDashboardUserSummary";
import { SecuritySummaryBand } from "@/components/account/SecuritySummaryBand";

/**
 * «Панель» кабинета — по макету `docs/design/Realtor Dashboard.html`.
 *
 * ⚠ ЗАГОЛОВОК СВЁРСТАН ЗДЕСЬ, А НЕ ЧЕРЕЗ `PageHeading`. Макет даёт ему свою
 * трактовку — подчёркивающая линия и другой ритм отступов, — а `PageHeading`
 * стоит ещё на десяти страницах кабинета и на публичных экранах. Менять его
 * ради одной страницы значит переверстать девять чужих; поэтому «Панель»
 * ведёт себя по макету, остальные страницы — по-прежнему. Расхождение
 * зафиксировано в отчёте: распространение на них — отдельное решение.
 *
 * ⚠ Ширина колонки контента — 660px из макета. Ограничение живёт ТОЛЬКО на
 * этой странице: таблицы объектов и заявок специально сидят в широком
 * контейнере (`size="wide"`, см. `(cabinet)/layout.tsx`) и 660px их обрежет.
 */
export default function AccountDashboardPage() {
  return (
    <div className="max-w-[660px]">
      <header className="border-b border-border pb-6">
        <h1 className="text-h1 text-fg">Панель</h1>
        <p className="mt-2.5 text-body-lg text-fg-muted">
          Обзор личного кабинета сотрудника
        </p>
      </header>

      {/* Superadmin only, and invisible unless something actually happened. */}
      <div className="mt-8 empty:mt-0">
        <SecuritySummaryBand />
      </div>

      <div className="mt-8">
        <AccountDashboardUserSummary />
      </div>

      {/*
        Строка быстрых ссылок. Макет её не рисует — он показывает только
        заголовок и карточку, — но на странице она есть и в задаче названа
        частью экрана, поэтому она сохранена и приведена к тем же токенам,
        а не выдумана заново и не удалена.
      */}
      <p className="mt-6 text-small text-fg-muted">
        Основные разделы:{" "}
        <Link
          href="/account/properties"
          className="font-medium text-brand underline-offset-2 hover:underline"
        >
          объекты
        </Link>
        ,{" "}
        <Link
          href="/account/inquiries"
          className="font-medium text-brand underline-offset-2 hover:underline"
        >
          заявки
        </Link>
        ,{" "}
        <Link
          href="/account/profile"
          className="font-medium text-brand underline-offset-2 hover:underline"
        >
          профиль
        </Link>
        .
      </p>
    </div>
  );
}
