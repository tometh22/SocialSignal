import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import SidebarFixed from '../client/src/components/layout/sidebar-fixed';
import AreaNavigation from '../client/src/components/layout/area-navigation';

const fixture = vi.hoisted(() => ({
  user: {
    id: 3,
    firstName: 'Tomás',
    lastName: 'Criado',
    isAdmin: true,
    role: 'admin',
    permissions: [] as string[],
  },
}));
vi.mock('../client/src/hooks/use-auth', () => ({
  useAuth: () => ({ user: fixture.user }),
}));
function render(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(['reviews', 'list', fixture.user.id], []);
  client.setQueryData(['/api/crm/stats', 'navigation'], {
    overdueReminders: 2,
  });
  const hook: () => [string, (to: string) => void] = () => [path, () => {}];
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        Router,
        { hook },
        createElement(SidebarFixed),
        createElement(AreaNavigation),
      ),
    ),
  );
  client.clear();
  return html;
}
afterEach(() => {
  fixture.user = {
    id: 3,
    firstName: 'Tomás',
    lastName: 'Criado',
    isAdmin: true,
    role: 'admin',
    permissions: [],
  };
});

describe('real application navigation rendering', () => {
  it('shows eight main areas and marks the finance area and the extra Costos tool active', () => {
    const html = render('/finance/costos');
    const mainMenu =
      html.match(
        /<nav[^>]*aria-label="Áreas de Mind"[^>]*>([\s\S]*?)<\/nav>/,
      )?.[1] ?? '';
    expect(mainMenu.match(/<a /g)).toHaveLength(8);
    const selected =
      mainMenu.match(/<a\b[^>]*aria-current="page"[^>]*>/g) ?? [];
    expect(selected).toHaveLength(1);
    expect(selected[0]).toContain('href="/dashboard"');
    expect(html).toContain('Herramientas de Finanzas');
    expect(html).toContain('Costos');
    expect(mainMenu).not.toContain('Provisiones');
  });
  it('renders the same provider restriction in the actual sidebar, with no favorites or contextual admin access', () => {
    fixture.user = { ...fixture.user, role: 'external_provider' };
    const html = render('/provider/dashboard');
    expect(html).toContain('Mi panel');
    expect(html).toContain('Mis facturas');
    expect(html).not.toContain('Favoritos');
    expect(html).not.toContain('Administración');
    expect(html).not.toContain('Finanzas');
  });
  it('does not expose report-only users to finance entry or management tools', () => {
    fixture.user = {
      ...fixture.user,
      isAdmin: false,
      role: 'member',
      permissions: ['dashboard'],
    };
    const html = render('/finance/costos');
    expect(html).toContain('Resumen financiero');
    expect(html).toContain('Proyección');
    expect(html).not.toContain('Cashflow');
    expect(html).not.toContain('Cargar datos');
    expect(html).not.toContain('Usuarios');
  });
});
