"use client";

import { useState } from "react";
import { authBearerHeaders } from "@/lib/crmAuth";
import { employeeAuthAbsoluteUrl } from "@/lib/crmAuthConstants";
import { setCrmNotifySoundEnabled } from "@/lib/crmUnreadCounts";
import { parseEmployeeUser } from "@/lib/employeeUser";
import {
  useEmployeeUser,
  useSetEmployeeUser,
} from "@/components/account/EmployeeAuthContext";
import { Icon, Icons } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * Переключатель звука уведомлений о новых заявках.
 *
 * ⭐ ЖИВЁТ В БОКОВОМ МЕНЮ КАБИНЕТА, прямо под пунктами «Заявки» / «Заявки на
 * продажу», которые он и озвучивает. Профиль был бы вторым по очевидности
 * местом, но там настройка утонула бы в форме с кнопкой «Сохранить»: звук
 * переключают импульсивно — в момент, когда он только что прозвучал не вовремя,
 * — и он обязан выключаться одним нажатием там, где на него смотрят.
 *
 * ⭐ НАСТРОЙКА ХРАНИТСЯ НА СЕРВЕРЕ (`User.crm_notify_sound_enabled`), не в
 * localStorage: она пориэлторная и обязана переживать другой браузер, другую
 * машину и очистку данных сайта.
 *
 * Оптимистично: переключаем сразу, при неудаче PATCH откатываем — тишина
 * важнее, чем «подождите». Ошибку не показываем баннером, но и не прячем:
 * положение переключателя возвращается на место, и это честно.
 */
export function CrmNotifySoundToggle() {
  const user = useEmployeeUser();
  const setUser = useSetEmployeeUser();
  const [busy, setBusy] = useState(false);
  const on = user.crm_notify_sound_enabled;

  const toggle = async () => {
    if (busy) return;
    const next = !on;
    setBusy(true);
    setUser({ ...user, crm_notify_sound_enabled: next });
    setCrmNotifySoundEnabled(next);
    try {
      const res = await fetch(employeeAuthAbsoluteUrl("me"), {
        method: "PATCH",
        headers: { ...authBearerHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ crm_notify_sound_enabled: next }),
      });
      if (!res.ok) throw new Error("patch failed");
      const fresh = parseEmployeeUser(await res.json().catch(() => null));
      if (fresh) {
        setUser(fresh);
        setCrmNotifySoundEnabled(fresh.crm_notify_sound_enabled);
      }
    } catch {
      setUser({ ...user, crm_notify_sound_enabled: on });
      setCrmNotifySoundEnabled(on);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => void toggle()}
      disabled={busy}
      className={cn(
        /* Отдельная «плитка» из макета, а не строка меню: настройка не
           навигация, и выглядеть одинаково с пунктами она не должна. */
        "mt-4 flex w-full items-center gap-2.5 rounded-xl border border-border",
        "bg-surface px-3 py-2.5 text-left transition-colors",
        "hover:bg-surface-inset focus-ring-brand disabled:opacity-60",
      )}
      title={
        on
          ? "Звук уведомлений включён — нажмите, чтобы выключить"
          : "Звук уведомлений выключен — нажмите, чтобы включить"
      }
    >
      <Icon
        icon={on ? Icons.Bell : Icons.BellOff}
        size={16}
        className={cn("shrink-0", on ? "text-brand" : "text-fg-muted")}
      />
      {/*
        ⚠ Без `truncate`: в колонке 280px подпись помещается целиком. В прежней
        колонке 208px она обрезалась до «Звук уведом…» `[measured]`.
      */}
      <span className="min-w-0 flex-1 text-caption font-medium text-fg-secondary">
        Звук уведомлений
      </span>
      {/* Положение читается и без цвета — на случай дальтонизма и печати:
          подпись «вкл»/«выкл» плюс точка-индикатор, а не только заливка. */}
      <span
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-full border py-0.5 pl-2 pr-2.5",
          "text-[11px] font-bold tracking-[0.02em]",
          on
            ? "border-brand-tint-2 bg-brand-tint text-brand"
            : "border-border bg-surface-inset text-fg-muted",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            on ? "bg-brand" : "bg-fg-muted",
          )}
        />
        {on ? "вкл" : "выкл"}
      </span>
    </button>
  );
}
