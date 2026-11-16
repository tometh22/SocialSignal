import { expect, test } from '@playwright/test';
import { buildBudgetMonths, type BudgetCostRow } from '../shared/finance-budget';

test('adds an estimated cost to a Mind month and shows the month total, keeping Máster months read-only', async ({ page }) => {
  expect((await page.request.post('/api/login', { data: { email: 'e2e-0@example.test', password: 'mind-local-test-only' } })).ok()).toBeTruthy();
  const costs: BudgetCostRow[] = [{ id: 1, period: '2027-02', native: false, detalle: 'Honorarios contables', subtipoCosto: 'Servicios', puesto: null, billingYear: 2027,
    horasUnidades: null, valorHora: null, monedaOriginalArs: null, monedaOriginalUsd: 800, cotizacion: null, montoTotalUsd: 800, pasadoFuturo: 'Futuro' }];
  const posts: any[] = [];
  const budget = () => ({ year: 2027, subtipos: ['Equipo', 'Servicios'],
    months: buildBudgetMonths({ year: 2027, masterPeriods: ['2027-02'], closeStatuses: new Map(), costs, sales: [], invoiced: new Map() }) });
  await page.route('**/api/finance/budget?*', route => route.fulfill({ json: budget() }));
  await page.route('**/api/finance/budget/costs', async route => {
    const body = route.request().postDataJSON();
    posts.push(body);
    const row: BudgetCostRow = { id: 2, period: body.period, native: true, detalle: body.detalle, subtipoCosto: body.subtipoCosto, puesto: null, billingYear: 2027,
      horasUnidades: null, valorHora: null, monedaOriginalArs: null, monedaOriginalUsd: body.amount, cotizacion: null, montoTotalUsd: body.amount, pasadoFuturo: 'Futuro' };
    costs.push(row);
    return route.fulfill({ status: 201, json: row });
  });

  await page.goto('/finance/proyeccion?period=2027-01');
  await page.getByRole('navigation', { name: 'Detalle de Proyección' }).getByRole('link', { name: 'Presupuesto' }).click();
  await expect(page).toHaveURL(/finance\/presupuesto\?period=2027-01/);
  await expect(page.getByRole('heading', { name: 'Presupuesto 2027' })).toBeVisible();

  const january = page.getByTestId('budget-costs-2027-01');
  await expect(january.getByTestId('budget-cost-total-2027-01')).toHaveText('Total USD 0');
  await january.getByRole('button', { name: 'Agregar costo' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Detalle').fill('Licencias de diseño');
  await dialog.getByLabel('Subtipo de costo').fill('Software');
  await dialog.getByLabel('Monto en USD').fill('1.500');
  await expect(dialog.getByTestId('budget-cost-preview')).toHaveText('USD 1.500');
  await dialog.getByRole('button', { name: 'Agregar costo' }).click();
  await expect(dialog).toHaveCount(0);
  expect(posts).toEqual([expect.objectContaining({ period: '2027-01', detalle: 'Licencias de diseño', subtipoCosto: 'Software', mode: 'usd', amount: 1500 })]);
  await expect(january.getByTestId('budget-cost-total-2027-01')).toHaveText('Total USD 1.500');
  await expect(january.getByRole('cell', { name: /^Licencias de diseño/ })).toBeVisible();

  const february = page.getByTestId('budget-costs-2027-02');
  await february.getByRole('button', { name: 'Febrero 2027' }).click();
  await expect(february).toContainText('Febrero 2027 se informa desde el Máster');
  await expect(february.getByRole('cell', { name: /^Honorarios contables/ })).toBeVisible();
  await expect(february.getByRole('button', { name: 'Agregar costo' })).toHaveCount(0);
  await expect(february.getByRole('button', { name: /Editar/ })).toHaveCount(0);
});
