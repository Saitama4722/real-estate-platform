import { Container } from "@/components/layout/container";
import { PageHeading } from "@/components/layout/page-heading";
import { CrmLeadsTable } from "@/components/crm/CrmLeadsTable";

export default function CrmLeadsPage() {
  return (
    <Container className="py-10">
      <PageHeading title="Лиды" subtitle="Данные с API «GET /api/crm/leads/»" />
      <CrmLeadsTable />
    </Container>
  );
}
