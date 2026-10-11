"use client";

import { AccountSidebar } from "@/components/account/AccountSidebar";
import { RequireEmployeeAuth } from "@/components/account/RequireEmployeeAuth";

/**
 * Двухколоночный каркас кабинета.
 *
 * Ширина боковой колонки — 280px из макета (была 208px, `md:w-52`), и именно
 * она чинит две вещи, которые в узкой колонке были неизбежны: почта риэлтора
 * перестаёт обрезаться, а подпись «Звук уведомлений» помещается целиком.
 *
 * ⚠ КОЛОНКА ФИКСИРОВАННОЙ ШИРИНЫ, КОНТЕНТ — `min-w-0 flex-1`. Без `min-w-0`
 * широкие таблицы CRM (объекты, заявки) распирают flex-элемент по своему
 * содержимому и выталкивают страницу за пределы окна.
 *
 * На мобильном (< md) колонки складываются в стопку, как и раньше: меню
 * сверху, контент под ним. Макет нарисован под 1440px и про узкие экраны
 * ничего не говорит — поведение оставлено прежним намеренно.
 */
export function AccountCabinetLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireEmployeeAuth>
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        <div className="md:w-[280px] md:shrink-0">
          <AccountSidebar />
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </RequireEmployeeAuth>
  );
}
