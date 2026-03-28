import { crmSectionById, type CrmSectionId } from "@/lib/crm/sections";

export function CrmSkeletonHeading({ sectionId }: { sectionId: CrmSectionId }) {
  const { title } = crmSectionById(sectionId);
  return (
    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
      {title}
    </h1>
  );
}
