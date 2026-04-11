import { Container } from "@/components/layout/container";
import { PageHeading } from "@/components/layout/page-heading";
import { CrmDashboardPanel } from "@/components/crm/CrmDashboardPanel";

export default function CrmDashboardPage() {
  return (
    <Container className="py-10">
      <PageHeading title="Панель управления" />
      <CrmDashboardPanel />
    </Container>
  );
}
