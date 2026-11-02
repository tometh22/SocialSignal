import type { LucideIcon } from 'lucide-react';
import {
  Home,
  CheckSquare,
  Briefcase,
  Target,
  ClipboardList,
  Gauge,
  BarChart2,
  Settings,
  FileText,
  Building2,
  Calendar,
  CalendarCheck,
  Receipt,
  UserX,
  Flag,
  LayoutGrid,
  Wallet,
  CircleArrowUp,
  CircleArrowDown,
  ShieldAlert,
  UploadCloud,
  LockKeyhole,
  Repeat,
  Coins,
  Database,
  BookOpen,
  Users,
} from 'lucide-react';
import {
  HOME_ACCESS_SECTIONS,
  TASK_ACCESS_SECTIONS,
  HOURS_DASHBOARD_ACCESS_SECTIONS,
  FINANCE_SUMMARY_ACCESS_SECTIONS,
  type AppSection,
} from '@/hooks/use-permissions';

export type NavigationUser =
  | {
      id?: number;
      role?: string | null;
      isAdmin?: boolean | null;
      permissions?: string[] | null;
    }
  | null
  | undefined;
export type NavigationItem = {
  href: string;
  title: string;
  icon: LucideIcon;
  description: string;
  aliases?: string[];
  matchPrefixes?: string[];
  permission?: AppSection;
  anyPermissions?: readonly AppSection[];
};
export type NavigationArea = {
  id: string;
  title: string;
  icon: LucideIcon;
  items: NavigationItem[];
};

export function navigationAreas(user: NavigationUser): NavigationArea[] {
  if (!user) return [];
  if (user.role === 'external_provider')
    return [
      {
        id: 'provider',
        title: 'Mi panel',
        icon: Briefcase,
        items: [
          {
            href: '/provider/dashboard',
            title: 'Mi panel',
            icon: Briefcase,
            description: 'Tus proyectos asignados',
          },
        ],
      },
      {
        id: 'personal-invoices',
        title: 'Mis facturas',
        icon: Receipt,
        items: [
          {
            href: '/my-invoices',
            title: 'Mis facturas',
            icon: Receipt,
            description: 'Tu factura mensual',
          },
        ],
      },
    ];
  const admin = !!user.isAdmin || user.role === 'admin';
  const has = (permission: AppSection) =>
    admin || !!user.permissions?.includes(permission);
  const operations = has('operations');
  const areas: NavigationArea[] = [
    {
      id: 'home',
      title: 'Inicio',
      icon: Home,
      items: [
        {
          href: '/',
          title: 'Inicio',
          icon: Home,
          description: 'Resumen personal',
          anyPermissions: HOME_ACCESS_SECTIONS,
        },
      ],
    },
    {
      id: 'work',
      title: 'Mi trabajo',
      icon: CheckSquare,
      items: [
        {
          href: '/tasks/my-tasks',
          title: 'Mis tareas',
          icon: CheckSquare,
          description: 'Tus tareas asignadas',
          anyPermissions: TASK_ACCESS_SECTIONS,
        },
        {
          href: '/tasks',
          title: 'Tareas',
          icon: CheckSquare,
          description: 'Gestión de tareas',
          anyPermissions: TASK_ACCESS_SECTIONS,
        },
        ...(!operations
          ? [
              {
                href: '/tasks/hours-dashboard',
                title: 'Mis horas',
                icon: BarChart2,
                description: 'Tus horas por período y proyecto',
                anyPermissions: HOURS_DASHBOARD_ACCESS_SECTIONS,
              },
            ]
          : []),
        {
          href: '/absences',
          title: 'Mis ausencias',
          icon: UserX,
          description: 'Solicitudes y saldos',
          anyPermissions: HOME_ACCESS_SECTIONS,
        },
        {
          href: '/my-invoices',
          title: 'Mis facturas',
          icon: Receipt,
          description: 'Tu cierre y comprobantes',
          anyPermissions: HOME_ACCESS_SECTIONS,
        },
      ],
    },
    {
      id: 'commercial',
      title: 'Comercial',
      icon: Target,
      items: [
        {
          href: '/crm',
          title: 'CRM',
          icon: Target,
          description: 'Oportunidades y seguimiento comercial',
          permission: 'crm',
        },
        {
          href: '/clients',
          title: 'Clientes',
          icon: Building2,
          description: 'Base de clientes',
          permission: 'crm',
        },
        {
          href: '/quotations',
          title: 'Cotizaciones',
          icon: FileText,
          description: 'Propuestas y presupuestos',
          permission: 'quotations',
          matchPrefixes: [
            '/optimized-quote',
            '/quotation-groups',
            '/manage-quotes',
            '/quotation',
            '/new-quote',
          ],
        },
      ],
    },
    {
      id: 'projects',
      title: 'Proyectos',
      icon: Briefcase,
      items: [
        {
          href:
            operations && has('projects')
              ? '/active-projects'
              : '/tasks/projects',
          title: operations ? 'Cartera' : 'Mis proyectos',
          icon: Briefcase,
          description: 'Proyectos y seguimiento',
          anyPermissions: TASK_ACCESS_SECTIONS,
          matchPrefixes: [
            '/active-projects',
            '/active-projects-next',
            '/tasks/projects',
            '/project-settings',
            '/projects',
            '/time-entries/project',
            '/client-summary',
            '/quality-scores',
            '/quarterly-nps',
            '/project-analytics',
          ],
        },
        {
          href: '/tasks/projects/kanban',
          title: 'Kanban',
          icon: LayoutGrid,
          description: 'Estado operativo de cada proyecto',
          anyPermissions: TASK_ACCESS_SECTIONS,
          aliases: ['tablero'],
        },
        {
          href: '/tasks/team-calendar',
          title: 'Calendario',
          icon: Calendar,
          description: 'Fechas y responsables de tareas',
          permission: 'operations',
        },
      ],
    },
    {
      id: 'status',
      title: 'Status',
      icon: ClipboardList,
      items: [
        {
          href: '/review',
          title: 'Salas',
          icon: ClipboardList,
          description: 'Status, seguimiento y decisiones',
          permission: 'status',
        },
        {
          href: '/review/objectives',
          title: 'Objetivos',
          icon: Flag,
          description: 'Plan del año y acciones de la semana',
          permission: 'operations',
        },
      ],
    },
    {
      id: 'operations',
      title: 'Operaciones',
      icon: Gauge,
      items: [
        {
          href: '/operations/absences',
          title: 'Gestión de ausencias',
          icon: UserX,
          description: 'Aprobar solicitudes y administrar cupos',
          permission: 'operations',
        },
        {
          href: '/tasks/hours-dashboard',
          title: 'Panel de horas',
          icon: BarChart2,
          description: 'Horas por persona y proyecto',
          permission: 'operations',
        },
        {
          href: '/operations/capacity',
          title: 'Capacidad',
          icon: Gauge,
          description: 'Disponibilidad semanal del equipo',
          permission: 'operations',
        },
        {
          href: '/operations/monthly-closing',
          title: 'Cierre del equipo',
          icon: CalendarCheck,
          description: 'Autorizaciones y facturas',
          permission: 'operations',
          matchPrefixes: ['/operations/liquidaciones-equipo'],
        },
        {
          href: '/operations/holidays',
          title: 'Feriados',
          icon: Calendar,
          description: 'Calendario laboral',
          permission: 'operations',
        },
      ],
    },
    {
      id: 'finance',
      title: 'Finanzas',
      icon: BarChart2,
      items: [
        {
          href: '/dashboard',
          title: 'Resumen financiero',
          icon: BarChart2,
          description: 'KPIs económicos y operativos',
          anyPermissions: FINANCE_SUMMARY_ACCESS_SECTIONS,
        },
        {
          href: '/finance/cashflow',
          title: 'Cashflow',
          icon: Wallet,
          description: 'Movimientos y saldos bancarios',
          permission: 'finance',
          aliases: ['caja', 'bancos'],
        },
        {
          href: '/finance/activo',
          title: 'Activo',
          icon: CircleArrowUp,
          description: 'Cuentas a cobrar y activos líquidos',
          permission: 'finance',
          aliases: ['cobros'],
        },
        {
          href: '/finance/pasivo',
          title: 'Pasivo',
          icon: CircleArrowDown,
          description: 'Cuentas a pagar y deudas',
          permission: 'finance',
          aliases: ['pagos'],
        },
        {
          href: '/finance/cierre',
          title: 'Cierre financiero',
          icon: LockKeyhole,
          description: 'Checklist y cierre mensual',
          permission: 'finance',
        },
        {
          href: '/finance/cargar',
          title: 'Cargar datos',
          icon: UploadCloud,
          description: 'Texto, archivos y capturas',
          permission: 'finance',
        },
        {
          href: '/finance/facturas-equipo',
          title: 'Facturas equipo',
          icon: Receipt,
          description: 'Revisión y registro de pasivo',
          permission: 'finance',
        },
        {
          href: '/finance/provisions',
          title: 'Provisiones',
          icon: ShieldAlert,
          description: 'Provisiones y contingencias',
          permission: 'finance',
        },
        {
          href: '/finance/proyeccion',
          title: 'Proyección',
          icon: Target,
          description: 'Ejecutado y proyectado del ejercicio',
          anyPermissions: FINANCE_SUMMARY_ACCESS_SECTIONS,
        },
        {
          href: '/finance/arr',
          title: 'ARR',
          icon: Repeat,
          description: 'Ingreso recurrente anualizado',
          anyPermissions: FINANCE_SUMMARY_ACCESS_SECTIONS,
        },
        {
          href: '/finance/rendimiento',
          title: 'Rendimiento',
          icon: Gauge,
          description: 'Markup y margen por cliente y proyecto',
          anyPermissions: FINANCE_SUMMARY_ACCESS_SECTIONS,
        },
        {
          href: '/finance/costos',
          title: 'Costos',
          icon: Coins,
          description: 'Desglose de costos',
          anyPermissions: FINANCE_SUMMARY_ACCESS_SECTIONS,
        },
      ],
    },
    {
      id: 'admin',
      title: 'Administración',
      icon: Settings,
      items: [
        {
          href: '/admin',
          title: 'Configuración',
          icon: Settings,
          description: 'Administración general',
          permission: 'admin',
        },
        {
          href: '/admin/users',
          title: 'Usuarios',
          icon: Users,
          description: 'Usuarios y permisos',
          permission: 'admin',
        },
        {
          href: '/admin/providers',
          title: 'Proveedores',
          icon: Building2,
          description: 'Accesos de proveedores',
          permission: 'admin',
        },
        {
          href: '/admin/data-sources',
          title: 'Fuentes de datos',
          icon: Database,
          description: 'Origen de los datos',
          permission: 'admin',
        },
        {
          href: '/admin/definitions',
          title: 'Definiciones',
          icon: BookOpen,
          description: 'Reglas de producto',
          permission: 'admin',
        },
      ],
    },
  ];
  return areas
    .map((area) => ({
      ...area,
      items: area.items.filter(
        (item) =>
          (!item.permission || has(item.permission)) &&
          (!item.anyPermissions || item.anyPermissions.some(has)),
      ),
    }))
    .filter((area) => area.items.length > 0);
}

export function navigationPath(path: string) {
  return path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
}
export function activeNavigation(areas: NavigationArea[], location: string) {
  const path = navigationPath(location);
  let result: { area: NavigationArea; item: NavigationItem } | undefined;
  let best = -1;
  for (const area of areas)
    for (const item of area.items)
      for (const prefix of [item.href, ...(item.matchPrefixes ?? [])]) {
        if (
          path === prefix ||
          (prefix !== '/' && path.startsWith(prefix + '/'))
        ) {
          if (prefix.length > best) {
            best = prefix.length;
            result = { area, item };
          }
        }
      }
  return result;
}
export function searchNavigation(areas: NavigationArea[], query: string) {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es');
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return areas
    .flatMap((area) => area.items.map((item) => ({ area, item })))
    .filter(({ area, item }) =>
      terms.every((term) =>
        normalize(
          [
            area.title,
            item.title,
            item.description,
            ...(item.aliases ?? []),
          ].join(' '),
        ).includes(term),
      ),
    );
}

export const MAX_NAV_FAVORITES = 4;
export const favoritesStorageKey = (userId: number) =>
  `mind:navigation:favorites:v1:${userId}`;
export function favoriteItems<T extends { href: string }>(
  options: T[],
  paths: string[],
): T[] {
  return [...new Set(paths)]
    .flatMap((path) => {
      const item = options.find((option) => option.href === path);
      return item ? [item] : [];
    })
    .slice(0, MAX_NAV_FAVORITES);
}
export function parseFavoritePaths(
  raw: string | null,
  defaults: string[],
): string[] {
  try {
    const parsed = raw === null ? defaults : JSON.parse(raw);
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter((path): path is string => typeof path === 'string'),
          ),
        ].slice(0, MAX_NAV_FAVORITES)
      : defaults;
  } catch {
    return defaults;
  }
}
