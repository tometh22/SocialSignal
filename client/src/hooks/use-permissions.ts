import { useAuth } from "@/hooks/use-auth";
import { getFirstAllowedRouteForUser } from "@/lib/first-allowed-route";

export type AppSection = 'crm' | 'quotations' | 'projects' | 'status' | 'dashboard' | 'finance' | 'admin' | 'operations';

export const ALL_SECTIONS: AppSection[] = ['crm', 'quotations', 'projects', 'status', 'dashboard', 'finance', 'admin', 'operations'];

/**
 * Route access groups.
 *
 * These lists keep navigation and route guards aligned without granting a new
 * section permission:
 * - Home is a personal, permission-aware surface, so any internal app section
 *   can use it. External providers have no app sections and keep their own home.
 * - The financial summary is shared by the legacy executive-dashboard and
 *   finance audiences.
 * - The hours panel is shared by project and operations teams.
 */
export const HOME_ACCESS_SECTIONS: readonly AppSection[] = ALL_SECTIONS;
export const FINANCE_SUMMARY_ACCESS_SECTIONS = ['dashboard', 'finance'] as const satisfies readonly AppSection[];
export const HOURS_DASHBOARD_ACCESS_SECTIONS = ['projects', 'operations'] as const satisfies readonly AppSection[];

export const SECTION_LABELS: Record<AppSection, string> = {
  crm: 'CRM',
  quotations: 'Cotizaciones',
  projects: 'Proyectos',
  status: 'Status',
  dashboard: 'Resumen financiero',
  finance: 'Finanzas',
  admin: 'Administración',
  operations: 'Operaciones',
};

export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = (section: AppSection): boolean => {
    if (!user) return false;
    if ((user as any).isAdmin) return true;
    const perms: string[] = (user as any).permissions || [];
    return perms.includes(section);
  };

  const hasAnyPermission = (sections: readonly AppSection[]): boolean =>
    sections.some(section => hasPermission(section));

  const getFirstAllowedRoute = (): string => getFirstAllowedRouteForUser(user as any);

  const allowedSections = ALL_SECTIONS.filter(s => hasPermission(s));

  // Role helpers: operations team sees capacity, closings, rates
  const isOperations = hasPermission('operations') || (user as any)?.isAdmin;
  // Team members see their own hours only (no capacity/idle metrics)
  const isTeamMember = !!user && !isOperations;

  return { hasPermission, hasAnyPermission, getFirstAllowedRoute, allowedSections, isOperations, isTeamMember };
}
