import { AccountStaffRealtorsPanel } from "@/components/account/AccountStaffRealtorsPanel";
import { PageHeading } from "@/components/layout/page-heading";

export default function AccountStaffPage() {
  return (
    <>
      <PageHeading title="Сотрудники" subtitle="Риэлторы: список и управление учётными записями" />
      <AccountStaffRealtorsPanel />
    </>
  );
}
