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

/** Parse GET /api/auth/me/ JSON into `EmployeeUser` or null. */
export function parseEmployeeUser(data: unknown): EmployeeUser | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (typeof o.id !== "number" || typeof o.email !== "string" || typeof o.role !== "string") {
    return null;
  }
  let crm_capabilities: EmployeeCrmCapabilities | undefined;
  const capsRaw = o.crm_capabilities;
  if (capsRaw && typeof capsRaw === "object") {
    const c = capsRaw as Record<string, unknown>;
    crm_capabilities = {
      create_property: Boolean(c.create_property),
      edit_property: Boolean(c.edit_property),
      delete_property: Boolean(c.delete_property),
      view_clients: Boolean(c.view_clients),
      delete_clients: Boolean(c.delete_clients),
      change_status: Boolean(c.change_status),
    };
  }
  return {
    id: o.id,
    email: o.email,
    first_name: typeof o.first_name === "string" ? o.first_name : "",
    last_name: typeof o.last_name === "string" ? o.last_name : "",
    phone: typeof o.phone === "string" ? o.phone : undefined,
    crm_id: typeof o.crm_id === "string" ? o.crm_id : undefined,
    avatar: typeof o.avatar === "string" ? o.avatar : null,
    role: o.role,
    is_active: Boolean(o.is_active),
    is_staff: Boolean(o.is_staff),
    crm_capabilities,
  };
}

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
