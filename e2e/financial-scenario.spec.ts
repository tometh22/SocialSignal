import { expect, test, type Page } from '@playwright/test';

const year = new Date().getFullYear();
function scenarioFixture(selectedYear: number) {
  return {
    year: selectedYear,
    months: Array.from({ length: 12 }, (_, index) => ({
      periodKey: `${selectedYear}-${String(index + 1).padStart(2, '0')}`, monthLabel: `${String(index + 1).padStart(2, '0')} mes`,
      revenueUsd: 3000, costUsd: 1000, ebitUsd: 2000, netProfitUsd: index < 10 ? 1500 : null,
    })),
    costs: [
      ...Array.from({ length: 35 }, (_, index) => ({ id: `ledger:${index}`, periodKey: `${selectedYear}-01`,
        concept: 'Tarjeta USA', description: `Replit consumo ${index + 1}`, category: 'Tecnología', date: null,
        source: 'ledger', amountUsd: 10, impact: 'operating' })),
      { id: 'ledger:railway', periodKey: `${selectedYear}-02`, concept: 'Tarjeta USA', description: 'Railway hosting',
        category: 'Tecnología', date: null, source: 'ledger', amountUsd: 20, impact: 'operating' },
    ],
  };
}

async function openProjection(page: Page) {
  expect((await page.request.post('/api/login', { data: { email: 'e2e-0@example.test', password: 'mind-local-test-only' } })).ok()).toBeTruthy();
  await page.route('**/api/v2/executive/proyeccion?year=*', route => {
    const selectedYear = Number(new URL(route.request().url()).searchParams.get('year'));
    const fixture = scenarioFixture(selectedYear);
    return route.fulfill({ json: { year: selectedYear, facturacion: { ejecutado: 0, proyectado: 36000, total: 36000 },
      costos: { ejecutado: 0, proyectado: 12000, total: 12000 }, resultado: { ejecutado: 0, proyectado: 24000, total: 24000 },
      mesesCerrados: 0, mesesProyectados: 12, meses: fixture.months.map((month, index) => ({ periodKey: month.periodKey,
        month: index + 1, monthLabel: month.monthLabel, cierre: false, fuenteFacturacion: 'master',
        facturacion: month.revenueUsd, costos: month.costUsd, resultado: month.ebitUsd })) } });
  });
  await page.goto('/finance/proyeccion');
  await page.getByRole('button', { name: 'Simular exclusiones' }).click();
}

test('annual exclusions work across search results and pages, can be undone and reset on year change', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', request => { if (request.url().includes('/proyeccion') && request.method() !== 'GET') writes.push(request.method()); });
  await page.route('**/api/v2/executive/proyeccion/escenario?year=*', route => route.fulfill({
    json: scenarioFixture(Number(new URL(route.request().url()).searchParams.get('year'))),
  }));
  await openProjection(page);
  const panel = page.getByTestId('cost-scenario');
  await panel.getByRole('button', { name: 'Replit', exact: true }).click();
  await expect(panel.getByRole('checkbox', { name: 'Excluir todas las coincidencias', exact: true })).toBeVisible();
  await panel.getByRole('checkbox', { name: 'Excluir todas las coincidencias', exact: true }).check();
  await expect(page.getByTestId('scenario-excluded')).toContainText('350,00');
  await expect(page.getByTestId('scenario-excluded')).toContainText('35 movimientos');
  await expect(page.getByTestId('scenario-net')).toContainText('15.350,00');
  await expect(panel.getByText('No se presenta ese subtotal como beneficio anual.', { exact: false })).toBeVisible();
  await panel.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(panel.getByRole('checkbox', { name: 'Excluir Replit consumo 35 · 01 mes', exact: true })).toBeChecked();
  await panel.getByRole('button', { name: 'Railway', exact: true }).click();
  await panel.getByRole('checkbox', { name: 'Excluir Railway hosting · 02 mes', exact: true }).check();
  await expect(page.getByTestId('scenario-excluded')).toContainText('370,00');
  await panel.getByRole('textbox', { name: 'Buscar conceptos en todo el año' }).fill('Replit, Railway');
  await expect(panel.getByRole('checkbox', { name: 'Excluir todas las coincidencias', exact: true })).toBeChecked();
  await panel.getByRole('heading', { name: 'Escenario sin reinversión' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.context/scenario-preview.png' });
  await panel.getByRole('button', { name: 'Reincorporar todo' }).click();
  await expect(page.getByTestId('scenario-excluded')).toContainText('0 movimientos');
  await panel.getByRole('checkbox', { name: 'Excluir todas las coincidencias', exact: true }).check();
  await page.getByRole('combobox').filter({ hasText: String(year) }).click();
  await page.getByRole('option', { name: String(year - 1), exact: true }).click();
  await page.getByRole('button', { name: 'Simular exclusiones' }).click();
  await expect(page.getByTestId('scenario-excluded')).toContainText('0 movimientos');
  expect(writes).toEqual([]);
});

test('the cost endpoint enforces permissions and year validation', async ({ request }) => {
  expect((await request.get(`/api/v2/executive/proyeccion/escenario?year=${year}`)).status()).toBe(401);
  await request.post('/api/login', { data: { email: 'e2e-1@example.test', password: 'mind-local-test-only' } });
  expect((await request.get(`/api/v2/executive/proyeccion/escenario?year=${year}`)).status()).toBe(403);
  await request.post('/api/login', { data: { email: 'e2e-0@example.test', password: 'mind-local-test-only' } });
  expect((await request.get('/api/v2/executive/proyeccion/escenario?year=invalid')).status()).toBe(400);
  const response = await request.get(`/api/v2/executive/proyeccion/escenario?year=${year}`);
  expect(response.status()).toBe(200);
  expect((await response.json()).months).toHaveLength(12);
});

test('an unavailable source can be retried without showing an invented zero result', async ({ page }) => {
  let failed = true;
  await page.route('**/api/v2/executive/proyeccion/escenario?year=*', route => failed
    ? route.fulfill({ status: 500, json: { message: 'Unavailable' } })
    : route.fulfill({ json: scenarioFixture(year) }));
  await openProjection(page);
  const panel = page.getByTestId('cost-scenario');
  await expect(panel.getByRole('button', { name: 'Reintentar' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('scenario-excluded')).toHaveCount(0);
  failed = false;
  await panel.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByTestId('scenario-excluded')).toContainText('0 movimientos');
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.getByRole('textbox', { name: 'Buscar conceptos en todo el año' }).fill('Inexistente');
  await expect(panel.getByText('No hay coincidencias.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
