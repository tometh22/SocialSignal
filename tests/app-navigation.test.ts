import { describe, expect, it } from 'vitest';
import {
  activeNavigation,
  favoritesStorageKey,
  favoriteItems,
  navigationAreas,
  parseFavoritePaths,
  searchNavigation,
} from '../client/src/lib/app-navigation';

const admin = { id: 3, isAdmin: true, permissions: [] };
const all = navigationAreas(admin);
const hrefs = (permissions: string[]) =>
  navigationAreas({ permissions }).flatMap((area) =>
    area.items.map((item) => item.href),
  );

describe('permission-aware navigation areas', () => {
  it('keeps the original destinations available while reducing the main menu to eight areas', () => {
    expect(all.map((area) => area.title)).toEqual([
      'Inicio',
      'Mi trabajo',
      'Comercial',
      'Proyectos',
      'Status',
      'Operaciones',
      'Finanzas',
      'Administración',
    ]);
    const destinations = new Set(
      all.flatMap((area) => area.items.map((item) => item.href)),
    );
    for (const href of [
      '/',
      '/review/objectives',
      '/absences',
      '/my-invoices',
      '/crm',
      '/clients',
      '/quotations',
      '/active-projects',
      '/tasks/projects/kanban',
      '/tasks',
      '/tasks/team-calendar',
      '/review',
      '/operations/absences',
      '/tasks/hours-dashboard',
      '/operations/capacity',
      '/operations/monthly-closing',
      '/operations/holidays',
      '/finance/cargar',
      '/finance/facturas-equipo',
      '/finance/cierre',
      '/finance/cashflow',
      '/finance/activo',
      '/finance/pasivo',
      '/finance/provisions',
      '/dashboard',
      '/finance/proyeccion',
      '/finance/arr',
      '/finance/rendimiento',
      '/finance/costos',
      '/admin',
      '/admin/users',
      '/admin/providers',
      '/admin/data-sources',
      '/admin/definitions',
    ])
      expect(destinations.has(href), href).toBe(true);
    expect(destinations.size).toBe(
      all.reduce((count, area) => count + area.items.length, 0),
    );
  });
  it('keeps finance-only users out of commercial, administration, and operational tools', () => {
    const paths = hrefs(['finance']);
    expect(paths).toContain('/finance/cashflow');
    expect(paths).toContain('/dashboard');
    expect(paths).not.toContain('/admin');
    expect(paths).not.toContain('/tasks');
    expect(paths).not.toContain('/crm');
  });
  it('keeps report access separate from financial data entry', () => {
    expect(hrefs(['dashboard'])).toEqual(
      expect.arrayContaining([
        '/dashboard',
        '/finance/proyeccion',
        '/finance/costos',
      ]),
    );
    expect(hrefs(['dashboard'])).not.toContain('/finance/cashflow');
    expect(hrefs(['dashboard'])).not.toContain('/finance/cargar');
  });
  it('routes operations-only users to the task project hub instead of the projects-protected portfolio', () => {
    expect(hrefs(['operations'])).toContain('/tasks/projects');
    expect(hrefs(['operations'])).not.toContain('/active-projects');
    expect(hrefs(['operations'])).toContain('/review/objectives');
    expect(hrefs(['operations'])).not.toContain('/review');
  });
  it('retains task manager access without exposing costs, finance, or administration', () => {
    const areas = navigationAreas({ permissions: ['task_manager'] });
    expect(areas.map((area) => area.id)).toEqual(['home', 'work', 'projects']);
    expect(hrefs(['task_manager'])).toEqual(
      expect.arrayContaining([
        '/tasks/my-tasks',
        '/tasks',
        '/tasks/projects',
        '/tasks/hours-dashboard',
      ]),
    );
  });
  it('limits providers to their panel and invoices, including an inconsistent admin flag', () => {
    const provider = navigationAreas({
      role: 'external_provider',
      isAdmin: true,
      permissions: ['admin', 'finance'],
    });
    expect(
      provider.flatMap((area) => area.items.map((item) => item.href)),
    ).toEqual(['/provider/dashboard', '/my-invoices']);
    expect(navigationAreas(null)).toEqual([]);
    expect(navigationAreas({ permissions: [] })).toEqual([]);
  });
});

describe('contextual navigation and discovery', () => {
  it.each([
    ['/tasks/projects/kanban', 'projects', '/tasks/projects/kanban'],
    ['/tasks/projects/42?tab=hours', 'projects', '/active-projects'],
    ['/tasks/my-tasks', 'work', '/tasks/my-tasks'],
    ['/tasks/hours-dashboard', 'operations', '/tasks/hours-dashboard'],
    ['/review/objectives', 'status', '/review/objectives'],
    ['/review/1?item=c_195', 'status', '/review'],
    ['/admin/providers', 'admin', '/admin/providers'],
    ['/quotations/2/studio', 'commercial', '/quotations'],
    ['/optimized-quote/23', 'commercial', '/quotations'],
    ['/finance/costos/', 'finance', '/finance/costos'],
    ['/', 'home', '/'],
  ])('resolves %s to its most specific tool', (path, areaId, href) => {
    const active = activeNavigation(all, path);
    expect(active?.area.id).toBe(areaId);
    expect(active?.item.href).toBe(href);
  });
  it('does not infer areas for unavailable or lookalike routes', () => {
    expect(
      activeNavigation(
        navigationAreas({ permissions: ['finance'] }),
        '/admin/users',
      ),
    ).toBeUndefined();
    expect(activeNavigation(all, '/crm-other')).toBeUndefined();
  });
  it('finds tools by area, accents, synonyms, and permissions', () => {
    expect(
      searchNavigation(all, 'finanzas proyeccion').map(({ item }) => item.href),
    ).toEqual(['/finance/proyeccion']);
    expect(
      searchNavigation(all, 'bancos').map(({ item }) => item.href),
    ).toEqual(['/finance/cashflow']);
    expect(
      searchNavigation(
        navigationAreas({ permissions: ['task_manager'] }),
        'costos',
      ),
    ).toEqual([]);
    expect(
      searchNavigation(
        navigationAreas({ role: 'external_provider' }),
        'usuarios',
      ),
    ).toEqual([]);
  });
});

describe('personal favorites', () => {
  it('uses separate storage keys and respects an intentionally empty list', () => {
    expect(favoritesStorageKey(3)).not.toBe(favoritesStorageKey(5));
    expect(parseFavoritePaths(null, ['/review'])).toEqual(['/review']);
    expect(parseFavoritePaths('[]', ['/review'])).toEqual([]);
    expect(parseFavoritePaths('broken', ['/review'])).toEqual(['/review']);
  });
  it('deduplicates and caps preferences at four', () => {
    expect(
      parseFavoritePaths(
        '["/review","/review",1,"/tasks","/absences","/my-invoices","/admin"]',
        [],
      ),
    ).toEqual(['/review', '/tasks', '/absences', '/my-invoices']);
  });
  it('hides stale, unauthorized, external, or forged room paths from stored preferences', () => {
    const options = navigationAreas({ permissions: ['finance'] }).flatMap(
      (area) => area.items,
    );
    expect(
      favoriteItems(options, [
        '/admin',
        'javascript:alert(1)',
        'https://evil.test',
        '/review/99',
        '/finance/cashflow',
      ]),
    ).toEqual([options.find((item) => item.href === '/finance/cashflow')]);
  });
});
