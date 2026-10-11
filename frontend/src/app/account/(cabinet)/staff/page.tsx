import { AccountSiteContactsPanel } from "@/components/account/AccountSiteContactsPanel";
import { AccountStaffRealtorsPanel } from "@/components/account/AccountStaffRealtorsPanel";
import { PageHeading } from "@/components/layout/page-heading";

export default function AccountStaffPage() {
  return (
    <>
      <PageHeading title="Сотрудники" subtitle="Риэлторы: список и управление учётными записями" />
      <AccountStaffRealtorsPanel />
      {/* Site-level settings have no page of their own; this panel renders
          nothing for a non-superadmin. See its header comment. */}
      <AccountSiteContactsPanel />
    </>
  );
}
