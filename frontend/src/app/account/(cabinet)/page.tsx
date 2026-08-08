import Link from "next/link";
import { AccountDashboardUserSummary } from "@/components/account/AccountDashboardUserSummary";
import { SecuritySummaryBand } from "@/components/account/SecuritySummaryBand";
import { PageHeading } from "@/components/layout/page-heading";

export default function AccountDashboardPage() {
  return (
    <>
      <PageHeading title="Панель" subtitle="Обзор личного кабинета сотрудника" />
      {/* Superadmin only, and invisible unless something actually happened. */}
      <div className="mt-6">
        <SecuritySummaryBand />
      </div>
      <div className="mt-6">
        <AccountDashboardUserSummary />
      </div>
      <p className="mt-6 text-sm text-slate-600">
        Основные разделы:{" "}
        <Link href="/account/properties" className="font-medium text-sky-700 underline-offset-2 hover:underline">
          объекты
        </Link>
        ,{" "}
        <Link href="/account/inquiries" className="font-medium text-sky-700 underline-offset-2 hover:underline">
          заявки
        </Link>
        ,{" "}
        <Link href="/account/profile" className="font-medium text-sky-700 underline-offset-2 hover:underline">
          профиль
        </Link>
        .
      </p>
    </>
  );
}
