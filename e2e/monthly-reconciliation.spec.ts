import { expect, test } from '@playwright/test';

const report = {
  periodKey: '2026-10', source: 'master', readAt: '2026-11-01T12:00:00Z', costBasis: 'actual', status: 'matched', warnings: [],
  rows: [{ key: 'one', clientName: 'Cliente Uno', projectName: 'Servicio mensual', projectType: 'Fee', revenueUsd: 1000, directCostUsd: 200, sourceRefs: ['Ventas!R2'] }],
  followup: [{ key: 'future', clientName: 'Cliente Uno', projectName: 'Contrato futuro', projectType: 'One Shot', budgetUsd: 4000, cumulativeCostUsd: 5, status: 'open', sourceRef: 'Seguimiento!A2' }],
  missingFollowup: [],
  totals: { salesUsd: 1000, directCostUsd: 200, operatingCostUsd: 300, overheadUsd: 100, ebitUsd: 700,
    summarySalesUsd: 1000, summaryOperatingCostUsd: 300, salesDifferenceUsd: 0, costsDifferenceUsd: 0,
    closedProjectMarkup: null, summaryClosedProjectMarkup: null },
};

test('separates monthly results from open project budgets and fits mobile', async ({ page }) => {
  expect((await page.request.post('/api/login', { data: { email: 'e2e-0@example.test', password: 'mind-local-test-only' } })).ok()).toBeTruthy();
  const writes: string[] = [];
  page.on('request', request => { if (request.url().includes('/rendimiento') && request.method() !== 'GET') writes.push(request.method()); });
  await page.route('**/api/v2/executive/rendimiento*', route => route.fulfill({ json: { periodos: ['2026-10'], periodo: '2026-10', report } }));
  await page.goto('/finance/rendimiento');
  await expect(page.getByTestId('reconciliation-status')).toContainText('coincide');
  await expect(page.getByTestId('monthly-reconciliation')).toContainText('1.000,00');
  await expect(page.getByRole('cell', { name: 'Contrato futuro', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Proyectos acumulados', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'Contrato futuro' });
  await expect(row).toContainText('Abierto');
  await expect(row).toContainText('4.000,00');
  await expect(row).toContainText('Pendiente');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.context/reconciliation-mobile.png' });
  expect(writes).toEqual([]);
});

test('unavailable sources show a retry instead of a reconciled zero', async ({ page }) => {
  await page.request.post('/api/login', { data: { email: 'e2e-0@example.test', password: 'mind-local-test-only' } });
  await page.route('**/api/v2/executive/rendimiento*', route => route.fulfill({ status: 503, json: { message: 'Source unavailable' } }));
  await page.goto('/finance/rendimiento');
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('monthly-reconciliation')).toHaveCount(0);
});

test('report endpoints enforce authentication, permissions and period validation', async ({ request }) => {
  expect((await request.get('/api/v2/executive/rendimiento?period=2026-10')).status()).toBe(401);
  await request.post('/api/login', { data: { email: 'e2e-1@example.test', password: 'mind-local-test-only' } });
  expect((await request.get('/api/v2/executive/rendimiento?period=2026-10')).status()).toBe(403);
  await request.post('/api/login', { data: { email: 'e2e-0@example.test', password: 'mind-local-test-only' } });
  expect((await request.get('/api/v2/executive/rendimiento?period=2026-99')).status()).toBe(400);
  expect((await request.get('/api/v2/executive/recurring?period=2026-99')).status()).toBe(400);
});
