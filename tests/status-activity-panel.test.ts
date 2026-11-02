import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivityPanel } from '../client/src/pages/status-semanal';

vi.mock('../client/src/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: 3 } }) }));

describe.each(['project', 'custom'] as const)('complete %s Status history', kind => {
  it('shows all seven counted entries from both authors, including full updates and field changes', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const base = kind === 'project' ? '/api/status-semanal' : '/api/status-semanal/custom';
    const notes = [
      { type: 'note', id: 1, content: 'Comentario de Vicky', authorId: 5, authorName: 'Victoria Puricelli', createdAt: '2026-09-15T12:00:00Z' },
      { type: 'note', id: 2, content: 'Comentario de Tomi', authorId: 3, authorName: 'Tomás Criado', createdAt: '2026-09-17T12:00:00Z' },
    ];
    const updates = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1, content: `Update completo ${index + 1}\n\n• Primera meta\n• Segunda meta`,
      authorId: index % 2 ? 3 : 5, authorName: index % 2 ? 'Tomás Criado' : 'Victoria Puricelli',
      createdAt: `2026-09-${index + 16}T13:00:00Z`,
    }));
    client.setQueryData([base, 10, 'activity'], [...notes, {
      type: 'change', id: 1, userId: 3, userName: 'Tomás Criado', fieldName: 'healthStatus',
      oldValue: 'verde', newValue: 'amarillo', createdAt: '2026-09-21T12:00:00Z',
    }]);
    client.setQueryData([base, 10, 'updates'], updates);
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(ActivityPanel, {
      ...(kind === 'project' ? { projectId: 10 } : { customItemId: 10 }), projectName: 'Objetivos del cierre 2026', onClose: () => {},
    })));
    expect(html.match(/data-testid="activity-(note|update)-/g)).toHaveLength(7);
    for (const update of updates) expect(html).toContain(update.content.split('\n')[0]);
    expect(html).toContain('Victoria Puricelli');
    expect(html).toContain('Tomás Criado');
    expect(html).toContain('<ul');
    expect(html).toContain('cambió');
    expect(html.indexOf('Comentario de Vicky')).toBeLessThan(html.indexOf('Update completo 1'));
    expect(html.indexOf('Update completo 1')).toBeLessThan(html.indexOf('Comentario de Tomi'));
    // Note and update IDs overlap; each must remain a distinct entry.
    expect(html).toContain('activity-note-1');
    expect(html).toContain('activity-update-1');
    client.clear();
  });
});
