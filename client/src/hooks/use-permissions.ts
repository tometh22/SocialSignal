import { useAuth } from "@/hooks/use-auth";

export type AppSection = 'crm' | 'quotations' | 'projects' | 'dashboard' | 'finance' | 'admin';

export const ALL_SECTIONS: AppSection[] = ['crm', 'quotations', 'projects', 'dashboard', 'finance', 'admin'];

export const SECTION_LABELS: Record<AppSection, string> = {
  crm: 'CRM Ventas',
  quotations: 'Cotizaciones',
  projects: 'Proyectos y Operación',
  dashboard: 'Dashboard Ejecutivo',
  finance: 'Finanzas y Analytics',
  admin: 'Administración',
};

export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = (section: AppSection): boolean => {
    if (!user) return false;
    if ((user as any).isAdmin) return true;
    const perms: string[] = (user as any).permissions || [];
    return perms.includes(section);
  };

  const getFirstAllowedRoute = (): string => {
    if (!user) return '/auth';
    if ((user as any).isAdmin || hasPermission('dashboard')) return '/';
    if (hasPermission('crm')) return '/crm';
    if (hasPermission('quotations')) return '/quotations';
    if (hasPermission('projects')) return '/active-projects';
    if (hasPermission('finance')) return '/';
    return '/unauthorized';
  };

  const allowedSections = ALL_SECTIONS.filter(s => hasPermission(s));

  return { hasPermission, getFirstAllowedRoute, allowedSections };
}
