import { expect, test } from '@playwright/test';

test('daily starts with a blank message, preserves history and only posts new text', async ({ page }) => {
  const previous = 'Esto cambió con los últimos informes?';
  const items = [1, 2].map(id => ({ id, title: `Tema ${id}`, currentAction: previous,
    healthStatus: 'verde', decisionNeeded: 'ninguna', deadline: '2026-01-01',
    ownerId: 1, ownerName: 'Tomás', hiddenFromWeekly: false, updatedAt: '2026-01-01T12:00:00Z' }));
  const updates: Record<number, any[]> = Object.fromEntries(items.map(item => [item.id, [
    { id: item.id, content: previous, authorName: 'Tomás', createdAt: '2026-01-01T12:00:00Z' },
  ]]));
  const posts: any[] = [];
  let failNext = false;
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let data: any = [];
    if (path === '/api/current-user') data = { id: 1, firstName: 'Tomás', lastName: 'Prueba', email: 'daily@example.test', role: 'admin', isAdmin: true, permissions: ['status'] };
    else if (path === '/api/reviews/1') data = { id: 1, name: 'Status', myRole: 'owner', members: [] };
    else if (path === '/api/reviews/1/items/custom') data = items;
    else if (path.endsWith('/daily-sessions/latest')) data = { latest: null, todayDone: false };
    else if (/\/custom\/\d+\/updates$/.test(path)) {
      const id = Number(path.split('/').at(-2));
      if (request.method() === 'POST') {
        if (failNext) { failNext = false; await route.fulfill({ status: 500, json: { message: 'No se pudo guardar' } }); return; }
        const body = request.postDataJSON();
        posts.push(body);
        items[id - 1].currentAction = body.content;
        updates[id].push({ id: 10 + posts.length, content: body.content, authorName: 'Tomás', createdAt: new Date().toISOString() });
        data = updates[id].at(-1);
      } else data = updates[id];
    } else if (path.includes('notifications')) data = { notifications: [], unreadCount: 0 };
    await route.fulfill({ json: data });
  });
  await page.goto('/review/1');
  await page.getByRole('button', { name: 'Empezar la daily', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Estado actual', exact: true });
  await expect(editor).toHaveValue('');
  await expect(page.getByText(previous, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Todo igual, siguiente/ }).click();
  await expect(page.getByText('Tema 2', { exact: true }).last()).toBeVisible();
  await expect(editor).toHaveValue('');
  expect(posts).toEqual([]);
  await editor.fill('   ');
  await editor.press('Control+Enter');
  await expect(page.getByText('Sin cambios registrados. Todo sigue igual.')).toBeVisible();
  expect(posts).toEqual([]);

  await page.getByRole('button', { name: 'salir', exact: true }).click();
  await page.getByRole('button', { name: 'Empezar la daily', exact: true }).click();
  await expect(editor).toHaveValue('');
  await editor.fill('Nueva actualización');
  failNext = true;
  await page.getByRole('button', { name: /Guardar y siguiente/ }).click();
  await expect(page.getByText('No se pudo guardar el update', { exact: true })).toBeVisible();
  await expect(editor).toHaveValue('Nueva actualización');
  await editor.press('Control+Enter');
  await expect(editor).toHaveValue('');
  expect(posts).toEqual([{ content: 'Nueva actualización', expectedCurrentAction: previous }]);
  // Re-entering a reviewed item must not turn its saved update into a draft.
  await page.getByRole('button', { name: 'salir', exact: true }).click();
  await page.getByRole('button', { name: 'Empezar la daily por Tema 1', exact: true }).click();
  await expect(editor).toHaveValue('');
  await expect(page.getByText('Nueva actualización', { exact: true })).toBeVisible();
  await page.screenshot({ path: '.context/daily-empty-message.png', fullPage: true });
  expect(posts).toHaveLength(1);
});
