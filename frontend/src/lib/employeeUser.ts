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

/** Russian labels for `User.Role` values from the backend. */
export function employeeRoleLabelRu(role: string): string {
  switch (role) {
    case "superadmin":
      return "Суперадминистратор";
    case "admin":
      return "Администратор";
    case "realtor":
      return "Риэлтор";
    default:
      return role;
  }
}

/** Имя и фамилия в шапке кабинета; если пусто — email. */
export function formatEmployeeCabinetDisplayName(
  user: Pick<EmployeeUser, "first_name" | "last_name" | "email">,
): string {
  const full = `${(user.first_name ?? "").trim()} ${(user.last_name ?? "").trim()}`.trim();
  return full || user.email;
}
