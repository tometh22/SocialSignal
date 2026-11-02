import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StatusSemanalPage from '../client/src/pages/status-semanal';

vi.mock('../client/src/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: 3 } }) }));

function renderItems(items: Record<string, unknown>[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['/api/status-semanal?includeHidden=true'], []);
  client.setQueryData(['/api/status-semanal/custom?includeHidden=true'], items);
  client.setQueryData(['/api/status-semanal/users'], []);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(StatusSemanalPage)));
  client.clear();
  return html;
}

const item = (id: number, fields: Record<string, unknown> = {}) => ({
  id, title: `Tema ${id}`, healthStatus: 'verde', decisionNeeded: 'ninguna',
  ownerId: null, ownerName: null, hiddenFromWeekly: false,
  updatedAt: new Date().toISOString(), currentAction: 'En seguimiento',
  noteCount: 0, unreadCount: 0, ...fields,
});

beforeEach(() => vi.stubGlobal('localStorage', { getItem: () => 'list' }));
afterEach(() => vi.unstubAllGlobals());

describe('Status list with uneven groups', () => {
  it('renders every visible item once, prioritizing 22 attention items before three in progress', () => {
    const items = Array.from({ length: 25 }, (_, i) => item(i + 1, { healthStatus: i < 22 ? 'rojo' : 'verde' }));
    const html = renderItems(items);
    expect(html).toContain('data-testid="status-list"');
    expect(html).toContain('data-testid="status-attention-grid"');
    expect(html.indexOf('Para atender')).toBeLessThan(html.indexOf('En curso'));
    for (let id = 1; id <= 25; id++) expect(html.match(new RegExp(`id="row-c_${id}"`, 'g'))).toHaveLength(1);
    expect(html).not.toContain('panel lateral');
  });

  it('keeps pending decisions visible and excludes resolved items from the list', () => {
    const html = renderItems([
      item(1, { decisionNeeded: 'recursos' }),
      item(2),
      item(3, { hiddenFromWeekly: true }),
    ]);
    expect(html).toContain('Decisiones pendientes');
    expect(html).toContain('id="row-c_1"');
    expect(html).toContain('id="row-c_2"');
    expect(html).not.toContain('id="row-c_3"');
  });
});
