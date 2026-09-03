export const ROLES = ["ADMIN", "ADMIN_LEAD", "ADMIN_COMPANY", "IT", "MANAGEMENT", "SITE_STAFF"] as const;
export type AppRole = (typeof ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "แอดมินดูแลระบบ",
  ADMIN_LEAD: "หัวหน้าแอดมิน",
  ADMIN_COMPANY: "ผู้ช่วยหัวหน้าแอดมิน",
  IT: "ไอที",
  MANAGEMENT: "Management",
  SITE_STAFF: "พนักงานหน้าไซต์",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && ROLES.includes(value as AppRole);
}

export function isCompanyScoped(role: AppRole): boolean {
  return false;
}

export function canManageUsers(role: AppRole): boolean {
  return role === "ADMIN" || role === "ADMIN_LEAD";
}

export function canManageUserRole(actorRole: AppRole, targetRole: AppRole): boolean {
  return actorRole === "ADMIN" || (actorRole === "ADMIN_LEAD" && targetRole !== "ADMIN");
}

export function canManageCompanies(role: AppRole): boolean {
  return role === "ADMIN";
}

export function canViewLinks(role: AppRole): boolean {
  return ["ADMIN", "ADMIN_LEAD", "ADMIN_COMPANY", "IT", "MANAGEMENT"].includes(role);
}

export function canCreateLinks(role: AppRole): boolean {
  return role === "ADMIN" || role === "ADMIN_LEAD" || role === "ADMIN_COMPANY";
}

export function canEditLinks(role: AppRole): boolean {
  return role === "ADMIN" || role === "ADMIN_LEAD" || role === "ADMIN_COMPANY";
}

export function canDeleteLinks(role: AppRole): boolean {
  return role === "ADMIN";
}

export function canEditBackup(role: AppRole): boolean {
  return ["ADMIN", "ADMIN_LEAD", "ADMIN_COMPANY", "IT"].includes(role);
}

export function canViewIncidents(role: AppRole): boolean {
  return ["ADMIN", "ADMIN_LEAD", "ADMIN_COMPANY", "IT", "MANAGEMENT"].includes(role);
}

export function canActAsAdmin(role: AppRole): boolean {
  return role === "ADMIN" || role === "ADMIN_LEAD" || role === "ADMIN_COMPANY";
}

export function canActAsIt(role: AppRole): boolean {
  return role === "ADMIN" || role === "IT";
}

export function canViewKpi(role: AppRole): boolean {
  return ["ADMIN", "ADMIN_LEAD", "ADMIN_COMPANY", "MANAGEMENT"].includes(role);
}

export function canViewReport(role: AppRole): boolean {
  return role === "ADMIN" || role === "MANAGEMENT";
}

export function canRunCheck(role: AppRole): boolean {
  return role === "ADMIN" || role === "ADMIN_LEAD" || role === "ADMIN_COMPANY";
}

export function canManageMobileAgents(role: AppRole): boolean {
  return role === "ADMIN";
}

export function canViewMobileAgents(role: AppRole): boolean {
  return role === "ADMIN" || role === "SITE_STAFF";
}

export function canAccessCompany(role: AppRole, assignedCompanyIds: string[], companyId: string): boolean {
  return true;
}
