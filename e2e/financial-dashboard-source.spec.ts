import { expect, test } from '@playwright/test';
const year = new Date().getFullYear();
const month = (number: number) => ({ periodKey: `${year}-${String(number).padStart(2,'0')}`, year, month: number,
  monthLabel: number === 9 ? '09 sep' : `${number} mes`, cierre: number < 11, fuenteDatos: 'master',
  ventasDelMes: 1000, ebitOperativo: 400, beneficioNeto: number < 11 ? 200 : null,
  margenOperativo: 40, margenNeto: number < 11 ? 20 : null, beneficioNetoRoto: number >= 11,
  activoLiquido: 100, activoMedPlazo: 20, clientesACobrar: 300, activoTotal: 420,
  pasivoImpuestosUSA: 10, pasivoFacturacionAdelantada: 30, pasivoProveedores: 50, pasivoTotal: 90,
  balanceNeto: 330, cashflow: -25, cashflow60Dias: 75, markup: 2.5, proyeccionResultado: 400 });

test('dashboard identifies Master source, partial net/margin and the balance period without mixing tax periods', async ({ page }) => {
  const data = Array.from({length:12},(_,i)=>month(i+1));
  await page.route('**/api/v2/executive/dashboard?*', route => {
    const url = new URL(route.request().url());
    const isAnnual = url.searchParams.get('yearTotal') === 'true';
    const filtered = isAnnual ? { ...month(12), ventasDelMes:12000, ebitOperativo:4800, beneficioNeto:2000,
      margenNeto:20, beneficioNetoParcial:true, mesesSinBeneficioNeto:['11 mes','12 mes'], mesesAgregados:12,
      balancePeriodKey:`${year}-09`, balanceMonthLabel:'09 sep', balanceDesactualizado:true,
    } : month(Number(url.searchParams.get('month')) || 9);
    return route.fulfill({json:{data,filtered,available:data.map(m=>m.periodKey),sourceReadAt:'2026-11-06T12:00:00Z'}});
  });
  await page.request.post('/api/login', { data: { email:'e2e-0@example.test', password:'mind-local-test-only' } });
  await page.goto('/dashboard');
  await page.getByRole('button',{name:'Año',exact:true}).click();
  await expect(page.getByText('Fuente: Máster',{exact:true})).toBeVisible();
  await expect(page.getByText('Beneficio Neto (parcial)',{exact:true})).toBeVisible();
  await expect(page.getByText('Margen Neto (parcial)',{exact:true})).toBeVisible();
  await expect(page.getByText('$12.000,00',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('$2.000,00',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('20.00%',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('al cierre de 09 sep',{exact:false})).toBeVisible();
  const adjustments = page.getByText('– Ajustes al neto',{exact:true}).locator('../..');
  await expect(adjustments).toContainText('—');
  await page.screenshot({path:'.context/dashboard-source-preview.png',fullPage:false});
});

test('losses retain their minus sign in the income statement', async ({ page }) => {
  const filtered = { ...month(9), ebitOperativo:-123.45, beneficioNeto:-150.67, margenNeto:-15.067 };
  await page.route('**/api/v2/executive/dashboard?*',route=>route.fulfill({json:{filtered,data:[filtered],available:[filtered.periodKey]}}));
  await page.request.post('/api/login',{data:{email:'e2e-0@example.test',password:'mind-local-test-only'}});
  await page.goto('/dashboard');
  await expect(page.getByText('= EBIT Operativo',{exact:true}).locator('../..')).toContainText('$-123,45');
  await expect(page.getByText('= Beneficio Neto',{exact:true}).locator('../..')).toContainText('$-150,67');
});
