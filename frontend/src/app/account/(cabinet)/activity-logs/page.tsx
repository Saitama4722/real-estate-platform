import { PageHeading } from "@/components/layout/page-heading";
import { AccountActivityLogsPanel } from "@/components/account/AccountActivityLogsPanel";

export default function AccountActivityLogsPage() {
  return (
    <>
      <PageHeading
        title="Журнал активности"
        subtitle="Входы и выходы сотрудников в личный кабинет"
      />
      <AccountActivityLogsPanel />
    </>
  );
}
