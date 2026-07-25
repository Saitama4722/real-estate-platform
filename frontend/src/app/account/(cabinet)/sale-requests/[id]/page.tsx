import { PageHeading } from "@/components/layout/page-heading";
import { AccountSaleRequestDetail } from "@/components/account/AccountSaleRequestDetail";

interface SaleRequestDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountSaleRequestDetailPage({
  params,
}: SaleRequestDetailPageProps) {
  const { id } = await params;
  return (
    <>
      <PageHeading
        title="Заявка на продажу"
        subtitle="Просмотр и обработка обращения собственника"
      />
      <AccountSaleRequestDetail id={id} />
    </>
  );
}
