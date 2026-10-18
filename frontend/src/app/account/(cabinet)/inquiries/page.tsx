import { Suspense } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { AccountInquiriesTable } from "@/components/account/AccountInquiriesTable";

export default function AccountInquiriesPage() {
  return (
    <>
      <PageHeading title="Заявки" subtitle="Обращения с сайта и обработка лидов" />
      {/* The table reads `?lead=<id>` (deep link from the notification bell)
          via useSearchParams, which must sit under a Suspense boundary or the
          production build bails out of static rendering for this route. */}
      <Suspense fallback={<p className="mt-4 text-sm text-slate-600">Загрузка…</p>}>
        <AccountInquiriesTable />
      </Suspense>
    </>
  );
}
