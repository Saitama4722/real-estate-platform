import { PageHeading } from "@/components/layout/page-heading";
import { AccountInquiriesTable } from "@/components/account/AccountInquiriesTable";

export default function AccountInquiriesPage() {
  return (
    <>
      <PageHeading title="Заявки" subtitle="Обращения с сайта и обработка лидов" />
      <AccountInquiriesTable />
    </>
  );
}
