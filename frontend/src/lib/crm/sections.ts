/**
 * Canonical CRM section list (Stage 8.1 skeleton).
 * Routes and labels must stay aligned with each route under src/app/crm/.
 */
export const CRM_SECTION_IDS = [
  "login",
  "dashboard",
  "properties",
  "leads",
  "articles",
  "users",
] as const;

export type CrmSectionId = (typeof CRM_SECTION_IDS)[number];

export type CrmSection = {
  id: CrmSectionId;
  /** App Router path (no trailing slash) */
  path: string;
  /** Temporary skeleton page title */
  title: string;
};

export const CRM_SECTIONS: readonly CrmSection[] = [
  { id: "login", path: "/crm/login", title: "CRM — Login" },
  { id: "dashboard", path: "/crm/dashboard", title: "CRM — Dashboard" },
  { id: "properties", path: "/crm/properties", title: "CRM — Properties" },
  { id: "leads", path: "/crm/leads", title: "CRM — Leads" },
  { id: "articles", path: "/crm/articles", title: "CRM — Articles" },
  { id: "users", path: "/crm/users", title: "CRM — Users" },
] as const;

export function crmSectionById(id: CrmSectionId): CrmSection {
  const section = CRM_SECTIONS.find((s) => s.id === id);
  if (!section) {
    throw new Error(`Unknown CRM section id: ${id}`);
  }
  return section;
}
