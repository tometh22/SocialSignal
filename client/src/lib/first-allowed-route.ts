const INTERNAL_SECTIONS = [
  "crm",
  "quotations",
  "projects",
  "status",
  "dashboard",
  "finance",
  "admin",
  "operations",
] as const;

type RouteUser = {
  role?: string | null;
  isAdmin?: boolean | null;
  permissions?: string[] | null;
} | null | undefined;

/**
 * Single post-authentication landing decision used by login, the auth screen
 * and permission-aware navigation.
 */
export function getFirstAllowedRouteForUser(user: RouteUser): string {
  if (!user) return "/auth";
  if (user.role === "external_provider") return "/provider/dashboard";
  if (user.isAdmin) return "/";

  const permissions = user.permissions ?? [];
  if (INTERNAL_SECTIONS.some((section) => permissions.includes(section))) {
    return "/";
  }

  return "/unauthorized";
}
