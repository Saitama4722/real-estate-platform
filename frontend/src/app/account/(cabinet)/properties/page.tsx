import { PageHeading } from "@/components/layout/page-heading";
import { CrmPropertyTable } from "@/components/crm/CrmPropertyTable";
import { PropertyCreateForm } from "@/components/crm/PropertyCreateForm";

export default function AccountPropertiesPage() {
  return (
    <>
      <PageHeading title="Объекты" subtitle="Управление объектами недвижимости" />
      <div className="mt-6">
        <PropertyCreateForm />
      </div>
      <CrmPropertyTable />
    </>
  );
}
