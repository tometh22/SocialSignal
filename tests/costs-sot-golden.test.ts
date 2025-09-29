/**
 * 🎯 GOLDEN TEST: Costs Source of Truth - Agosto 2025
 * 
 * Test de regresión para los valores reconciliados de costos.
 * Evita que refactors borren accidentalmente el reconciler temporal.
 * 
 * Valores esperados (exactos) para agosto 2025:
 * - Warner Fee Marketing: USD 7,005.20
 * - Kimberly Fee Huggies: USD 2,436.09
 * - Modo Fee Mensual: ARS 497,550 (≈USD 369.93)
 * - Coelsa Fee Mensual: ARS 553,002 (≈USD 411.15)
 * 
 * Para eliminar este test: cuando la DB esté completa y se retire
 * el reconciler de server/domain/costs/index.ts
 */

const BASE_URL = 'http://localhost:5000';

describe('Costs SoT - Golden Values (Agosto 2025)', () => {
  
  test('Warner Fee Marketing debe retornar USD 7,005.20', async () => {
    const response = await fetch(`${BASE_URL}/api/costs?period=2025-08&source=fresh`);
    const data = await response.json();
    
    const warner = data.projects.find((p: any) => 
      p.clientName === 'Warner' && p.projectName === 'Fee Marketing'
    );
    
    expect(warner).toBeDefined();
    expect(warner.costUSDNormalized).toBe(7005.20);
    expect(warner.costDisplay.currency).toBe('USD');
    expect(warner.costDisplay.amount).toBe(7005.20);
    expect(warner.overridden).toBe(true);
  });

  test('Kimberly Fee Huggies debe retornar USD 2,436.09', async () => {
    const response = await fetch(`${BASE_URL}/api/costs?period=2025-08&source=fresh`);
    const data = await response.json();
    
    const kimberly = data.projects.find((p: any) => 
      p.clientName === 'Kimberly Clark' && p.projectName === 'Fee Huggies'
    );
    
    expect(kimberly).toBeDefined();
    expect(kimberly.costUSDNormalized).toBe(2436.09);
    expect(kimberly.costDisplay.currency).toBe('USD');
    expect(kimberly.costDisplay.amount).toBe(2436.09);
    expect(kimberly.overridden).toBe(true);
  });

  test('Modo Fee Mensual debe retornar ARS 497,550', async () => {
    const response = await fetch(`${BASE_URL}/api/costs?period=2025-08&source=fresh`);
    const data = await response.json();
    
    const modo = data.projects.find((p: any) => 
      p.clientName === 'Play Digital S.A (Modo)' && p.projectName === 'Fee Mensual'
    );
    
    expect(modo).toBeDefined();
    expect(modo.costDisplay.currency).toBe('ARS');
    expect(modo.costDisplay.amount).toBe(497550);
    
    // USD normalizado ≈ 497550 / 1345 = 369.93
    expect(modo.costUSDNormalized).toBeCloseTo(369.93, 1);
    expect(modo.overridden).toBe(true);
  });

  test('Coelsa Fee Mensual debe retornar ARS 553,002', async () => {
    const response = await fetch(`${BASE_URL}/api/costs?period=2025-08&source=fresh`);
    const data = await response.json();
    
    const coelsa = data.projects.find((p: any) => 
      p.clientName === 'Coelsa' && p.projectName === 'Fee Mensual'
    );
    
    expect(coelsa).toBeDefined();
    expect(coelsa.costDisplay.currency).toBe('ARS');
    expect(coelsa.costDisplay.amount).toBe(553002);
    
    // USD normalizado ≈ 553002 / 1345 = 411.15
    expect(coelsa.costUSDNormalized).toBeCloseTo(411.15, 1);
    expect(coelsa.overridden).toBe(true);
  });

  test('Endpoint /api/costs/debug debe pasar validación', async () => {
    const response = await fetch(`${BASE_URL}/api/costs/debug?period=2025-08`);
    const data = await response.json();
    
    expect(data.validationPassed).toBe(true);
    expect(data.ledger).toBeDefined();
    expect(data.ledger.length).toBeGreaterThan(0);
  });

  test('Overrides solo se aplican a agosto 2025', async () => {
    // Test que otros períodos NO tienen overrides
    const response = await fetch(`${BASE_URL}/api/costs?period=2025-07&source=fresh`);
    const data = await response.json();
    
    // Ningún proyecto debe tener overridden=true en julio
    const overriddenProjects = data.projects.filter((p: any) => p.overridden === true);
    expect(overriddenProjects.length).toBe(0);
  });
});

describe('Costs SoT - Business Rules', () => {
  
  test('FX rate para agosto 2025 debe ser 1345', async () => {
    const response = await fetch(`${BASE_URL}/api/costs?period=2025-08&source=fresh`);
    const data = await response.json();
    
    // Verificar que la conversión ARS→USD usa FX=1345
    const modo = data.projects.find((p: any) => 
      p.clientName === 'Play Digital S.A (Modo)' && p.projectName === 'Fee Mensual'
    );
    
    const expectedUSD = 497550 / 1345;
    expect(modo.costUSDNormalized).toBeCloseTo(expectedUSD, 2);
  });

  test('Anti-×100 no debe aplicarse a valores USD pequeños', async () => {
    const response = await fetch(`${BASE_URL}/api/costs/debug?period=2025-08`);
    const data = await response.json();
    
    // Verificar que no hay warnings de ANTI_x100 en valores pequeños
    const warner = data.ledger.find((l: any) => 
      l.clientName === 'Warner' && l.projectName === 'Fee Marketing'
    );
    
    if (warner && warner.warnings) {
      const antiWarnings = warner.warnings.filter((w: string) => w.includes('ANTI_x100'));
      expect(antiWarnings.length).toBe(0);
    }
  });

  test('USD corruptos (>100k) deben ser ignorados', async () => {
    const response = await fetch(`${BASE_URL}/api/costs/debug?period=2025-08`);
    const data = await response.json();
    
    // No debe haber warnings de CORRUPT_USD en los valores finales
    const corruptCount = data.ledger.filter((l: any) => 
      l.warnings?.some((w: string) => w.includes('CORRUPT_USD'))
    ).length;
    
    expect(corruptCount).toBe(0);
  });
});
