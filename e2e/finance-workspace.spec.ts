import { expect, test } from '@playwright/test';

const totals = { salesUsd:1000, directCostUsd:200, operatingCostUsd:600, overheadUsd:400, ebitUsd:400,
  summarySalesUsd:1000, summaryOperatingCostUsd:600, salesDifferenceUsd:0, costsDifferenceUsd:0 };
test.beforeEach(async ({ page }) => {
  expect((await page.request.post('/api/login',{data:{email:'e2e-0@example.test',password:'mind-local-test-only'}})).ok()).toBeTruthy();
  await page.route('**/api/v2/executive/rendimiento?*', route => {
    const period = new URL(route.request().url()).searchParams.get('period');
    return route.fulfill({ json:{periodos:[period],periodo:period,report:{periodKey:period,source:'master',costBasis:'actual',status:'matched',rows:[],followup:[],missingFollowup:[],warnings:[],totals}} });
  });
  await page.route('**/api/v2/executive/dashboard?*', route => {
    const params=new URL(route.request().url()).searchParams;
    const row={periodKey:`${params.get('year')}-${params.get('month')?.padStart(2,'0')}`,year:Number(params.get('year')),month:Number(params.get('month')),monthLabel:'Mes seleccionado',fuenteDatos:'master',ventasDelMes:1000,ebitOperativo:400,beneficioNeto:200,activoLiquido:100};
    return route.fulfill({json:{filtered:row,data:[row],available:[row.periodKey]}});
  });
});

test('shares a reference month through views, reload, and browser back', async ({ page }) => {
  await page.goto('/dashboard?period=2026-10');
  const picker=page.getByLabel('Mes de referencia de Finanzas');
  await expect(picker).toHaveValue('2026-10');
  await expect(page.getByRole('heading',{name:'Resumen financiero',exact:true})).toBeVisible();
  await picker.fill('2026-09');
  await expect(page.getByTestId('finance-data-status')).toContainText('Septiembre 2026');
  await page.getByRole('navigation',{name:'Vistas de Finanzas'}).getByRole('link',{name:'Clientes y proyectos'}).click();
  await expect(page).toHaveURL(/rendimiento\?period=2026-09/);
  await expect(page.getByRole('heading',{name:'Contribución por proyecto'})).toBeVisible();
  await page.reload();
  await expect(picker).toHaveValue('2026-09');
  await page.getByRole('navigation',{name:'Vistas de Finanzas'}).getByRole('link',{name:'Resumen',exact:true}).click();
  await page.goBack();
  await expect(page).toHaveURL(/rendimiento\?period=2026-09/);
  await page.setViewportSize({width:390,height:844});
  await expect(picker).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'.context/finance-workspace-mobile.png'});
});

test('missing December costs leave profit unavailable in the main summary', async ({ page }) => {
  await page.route('**/api/v2/executive/rendimiento?*',route=>route.fulfill({json:{report:{periodKey:'2026-12',source:'master',costBasis:'estimated',status:'unavailable',warnings:['Bonos pendientes de definir'],totals:{...totals,operatingCostUsd:null}}}}));
  await page.goto('/dashboard?period=2026-12');
  await page.getByText('Ver registros pendientes',{exact:true}).click();
  await expect(page.getByTestId('finance-data-status')).toContainText('Bonos pendientes de definir');
  await expect(page.getByTestId('finance-data-status')).toContainText('Faltan datos para conciliar');
  await expect(page.locator('[data-ui=metric-card]').filter({hasText:'Ganancia neta'})).toContainText('—');
  await expect(page.locator('[data-ui=metric-card]').filter({hasText:'Costos operativos'})).toContainText('Pendientes de completar');
  await page.screenshot({path:'.context/finance-summary-pending.png'});
});

test('bank and ledger failures cannot masquerade as empty balances', async ({ page }) => {
  await page.route('**/api/cashflow**',route=>route.fulfill({status:503,json:{message:'Unavailable'}}));
  await page.route('**/api/financial-accounts',route=>route.fulfill({json:[]}));
  await page.goto('/finance/cashflow?period=2026-10');
  await expect(page.getByRole('alert')).toContainText('No se pudieron cargar',{timeout:20000});
  await expect(page.getByText('Sin datos',{exact:true})).toHaveCount(4);
  await expect(page.getByText('No hay movimientos',{exact:false})).toHaveCount(0);
  await page.route('**/api/activo**',route=>route.fulfill({status:503,json:{message:'Unavailable'}}));
  await page.getByRole('navigation',{name:'Vistas de Finanzas'}).getByRole('link',{name:'Cobros y pagos'}).click();
  await expect(page.getByRole('alert').first()).toContainText('No se pudieron cargar',{timeout:20000});
  await expect(page.getByText('Sin datos',{exact:true})).toHaveCount(4);
});

test('project-only users have no financial workspace or actions', async ({ page }) => {
  await page.request.post('/api/login',{data:{email:'e2e-1@example.test',password:'mind-local-test-only'}});
  await page.goto('/finance/rendimiento?period=2026-10');
  await expect(page).toHaveURL(/unauthorized/);
  await expect(page.getByRole('region',{name:'Área de Finanzas'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Revisar cierre',exact:true})).toHaveCount(0);
});

test('dashboard access does not expose finance management actions', async ({ page }) => {
  const user=await (await page.request.get('/api/current-user')).json();
  await page.route('**/api/current-user',route=>route.fulfill({json:{...user,isAdmin:false,role:'member',permissions:['dashboard']}}));
  await page.goto('/dashboard?period=2026-10');
  const nav=page.getByRole('navigation',{name:'Vistas de Finanzas'});
  await expect(nav.getByRole('link',{name:'Resumen',exact:true})).toBeVisible();
  await expect(nav.getByRole('link',{name:'Caja',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Cargar información',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Revisar cierre',exact:true})).toHaveCount(0);
});

test('legacy finance links retain the requested month in the unified summary', async ({ page }) => {
  await page.goto('/executive/finanzas?period=2026-09');
  await expect(page).toHaveURL(/dashboard\?period=2026-09/);
  await expect(page.getByLabel('Mes de referencia de Finanzas')).toHaveValue('2026-09');
});

test('voiding a receivable asks for an audited reason in an in-app dialog', async ({ page }) => {
  const posts: unknown[] = [];
  await page.route('**/api/activo/summary**', route => route.fulfill({ json: { total: 1000, cobrado: 0, pendiente: 1000, vencido: 0 } }));
  await page.route('**/api/activo?*', route => route.fulfill({ json: { items: [{ id: 7, concepto: 'Fee octubre', clienteNombre: 'Cliente', nroFactura: 'A-0001', montoTotalUSD: '1000', outstandingUSD: '1000' }], pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 } } }));
  await page.route('**/api/activo/7/void', route => { posts.push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); });
  await page.goto('/finance/activo?period=2026-10');
  await page.getByRole('button', { name: 'Anular', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Anular A-0001');
  const confirm = dialog.getByRole('button', { name: 'Anular factura' });
  await dialog.getByLabel('Motivo').fill('dup');
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toHaveCount(0);
  expect(posts).toEqual([]);
  await page.getByRole('button', { name: 'Anular', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Motivo').fill('Factura duplicada');
  await page.getByRole('dialog').getByRole('button', { name: 'Anular factura' }).click();
  await expect.poll(() => posts).toEqual([{ reason: 'Factura duplicada' }]);
});

test('master months explain their source and do not offer edits that the next sync would undo', async ({ page }) => {
  await page.route('**/api/finance/period-source?*', route => route.fulfill({ json: { period: '2026-10', source: 'master', otherSourceRecords: { activo: 0, pasivo: 2, cashflow: 0, provisions: 0 } } }));
  await page.route('**/api/pasivo/summary**', route => route.fulfill({ json: { total: 2000, pagado: 0, pendiente: 2000, vencido: 0, bySubtipo: { Equipo: 2000 } } }));
  await page.route('**/api/pasivo?*', route => route.fulfill({ json: { items: [{ id: 9, detalle: 'Honorarios equipo', subtipoCosto: 'Equipo', montoTotalUSD: '2000', outstandingUSD: '2000', source: 'excel' }], pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 } } }));
  await page.goto('/finance/pasivo?period=2026-10');
  await expect(page.getByTestId('period-source')).toContainText('Este mes se informa desde el Máster');
  await expect(page.getByTestId('period-source')).toContainText('2 registros de Mind no se suman');
  await expect(page.getByRole('cell', { name: /Honorarios equipo/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anular', exact: true })).toHaveCount(0);
});
