"use client";

import { Container } from "@/components/layout/container";
import { PageHeading } from "@/components/layout/page-heading";
import { PropertyCreateForm } from "@/components/crm/PropertyCreateForm";
import { CrmPropertyTable } from "@/components/crm/CrmPropertyTable";

export default function CrmPropertiesPage() {
  return (
    <Container className="py-10">
      <PageHeading title="Объекты недвижимости" />
      <div className="mt-8">
        <PropertyCreateForm />
      </div>
      <CrmPropertyTable />
    </Container>
  );
}
