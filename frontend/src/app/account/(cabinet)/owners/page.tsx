import { PageHeading } from "@/components/layout/page-heading";
import { AccountOwnersTable } from "@/components/account/AccountOwnersTable";

export default function AccountOwnersPage() {
  return (
    <>
      <PageHeading
        title="Собственники"
        subtitle="Общая база собственников и привязанные к ним объекты"
      />
      <AccountOwnersTable />
    </>
  );
}
