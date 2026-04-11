/** Effective CRM capability flags from GET /api/auth/me/ (staff always true). */
export type EmployeeCrmCapabilities = {
  create_property: boolean;
  edit_property: boolean;
  delete_property: boolean;
  view_clients: boolean;
  delete_clients: boolean;
  change_status: boolean;
};

/** Payload shape from GET /api/auth/me/ (users.CurrentUserSerializer). */
export type EmployeeUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  crm_id?: string;
  avatar?: string | null;
  role: string;
  is_active: boolean;
  is_staff: boolean;
  crm_capabilities?: EmployeeCrmCapabilities;
};

/** Staff-level roles: same CRM scope as backend `has_staff_level_access`. */
export function isCabinetAdminRole(role: string): boolean {
  return role === "superadmin" || role === "admin";
}
