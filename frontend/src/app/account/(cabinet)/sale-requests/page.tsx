import { PageHeading } from "@/components/layout/page-heading";
import { AccountSaleRequestsTable } from "@/components/account/AccountSaleRequestsTable";

export default function AccountSaleRequestsPage() {
  return (
    <>
      <PageHeading
        title="Заявки на продажу"
        subtitle="Обращения собственников, желающих продать недвижимость через агентство"
      />
      <AccountSaleRequestsTable />
    </>
  );
}
