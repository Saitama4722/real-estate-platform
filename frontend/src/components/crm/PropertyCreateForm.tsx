"use client";

import { CrmPropertyFullForm } from "@/components/crm/CrmPropertyFullForm";

/** Форма создания объекта в кабинете (этап 9 — полный набор полей CRM). */
export function PropertyCreateForm() {
  return <CrmPropertyFullForm mode="create" />;
}
