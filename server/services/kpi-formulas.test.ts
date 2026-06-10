/**
 * 🧪 TESTS UNITARIOS - FÓRMULAS KPI
 * Verifica que las fórmulas de las 3 vistas (Operativo, Económico, Financiero)
 * coincidan con las del Excel "Seguimiento Financiero/Económico".
 */

import { describe, test, expect } from '@jest/globals';
import {
  validatePeriodKey,
  calculateOperativoKPIs,
  calculateEconomicoKPIs,
  calculateFinancieroKPIs,
  validateKPICoherence,
} from './kpi-formulas';

describe('validatePeriodKey', () => {
  test('acepta YYYY-MM válido', () => {
    expect(validatePeriodKey('2025-10').valid).toBe(true);
    expect(validatePeriodKey('2026-01').valid).toBe(true);
  });

  test('rechaza formatos inválidos', () => {
    expect(validatePeriodKey('2025-13').valid).toBe(false);
    expect(validatePeriodKey('2025-00').valid).toBe(false);
    expect(validatePeriodKey('25-10').valid).toBe(false);
    expect(validatePeriodKey('').valid).toBe(false);
    expect(validatePeriodKey('2019-05').valid).toBe(false); // año sospechoso
  });
});

describe('Operativo — EBIT = Devengado − Directos', () => {
  test('fórmula base', () => {
    const k = calculateOperativoKPIs(100_000, 60_000, 1600, 1200, 20, 10);
    expect(k.ebitOperativoUsd).toBe(40_000);
    expect(k.margenOperativoPct).toBeCloseTo(40, 5);
    expect(k.markupOperativo).toBeCloseTo(100_000 / 60_000, 5);
    expect(k.tarifaEfectivaUsd).toBeCloseTo(100_000 / 1200, 5);
    expect(k.horasFacturablesPct).toBeCloseTo(75, 5);
  });

  test('división por cero no produce NaN/Infinity', () => {
    const k = calculateOperativoKPIs(0, 0, 0, 0, 0, 0);
    expect(k.ebitOperativoUsd).toBe(0);
    expect(k.margenOperativoPct).toBe(0);
    expect(k.markupOperativo).toBe(0);
    expect(k.tarifaEfectivaUsd).toBe(0);
    expect(k.horasFacturablesPct).toBe(0);
  });
});

describe('Económico — EBIT = Devengado − Directos − Overhead', () => {
  test('fórmula base con overhead', () => {
    const k = calculateEconomicoKPIs(100_000, 60_000, 15_000, 20, 10);
    expect(k.ebitEconomicoUsd).toBe(25_000);
    expect(k.margenEconomicoPct).toBeCloseTo(25, 5);
    expect(k.overheadRatioPct).toBeCloseTo((15_000 / 75_000) * 100, 5);
  });
});

describe('Financiero — EBIT = Facturado − Directos − Overhead − Provisiones', () => {
  test('fórmula base contable', () => {
    const k = calculateFinancieroKPIs(
      120_000, // facturado
      60_000,  // directos
      15_000,  // overhead
      5_000,   // provisiones (bonos + impuestos vía FISCAL_SUBTIPOS)
      110_000, // cashIn
      90_000,  // cashOut
      50_000,  // cajaTotal
      200_000, // activoTotal
      80_000,  // pasivoTotal
      20, 10
    );
    expect(k.ebitContableUsd).toBe(40_000);
    expect(k.burnRateUsd).toBe(80_000);
    expect(k.cashFlowNetoUsd).toBe(20_000);
    expect(k.patrimonioUsd).toBe(120_000);
    expect(k.runwayMeses).toBeCloseTo(50_000 / 80_000, 5);
    expect(k.margenContablePct).toBeCloseTo((40_000 / 120_000) * 100, 5);
  });

  test('valor de validación del Excel: EBIT oct/2025 ≈ $42.301', () => {
    // Composición que reproduce el resultado conocido del Excel.
    // Lo que se valida es la FÓRMULA: el EBIT debe ser exactamente
    // Facturado − (Directos + Overhead + Provisiones), sin doble conteo
    // de los subtipos fiscales (que van al bucket provisiones).
    const facturado = 98_500;
    const directos = 42_199;
    const overhead = 9_000;
    const provisiones = 5_000;
    const k = calculateFinancieroKPIs(facturado, directos, overhead, provisiones, 0, 0, 0, 0, 0, 0, 0);
    expect(k.ebitContableUsd).toBeCloseTo(42_301, 0);
    // Coherencia: burn rate == suma de los 3 buckets de costo
    expect(k.burnRateUsd).toBe(directos + overhead + provisiones);
  });
});

describe('validateKPICoherence — detecta inconsistencias entre vistas', () => {
  test('valores coherentes pasan sin errores', () => {
    const devengado = 100_000, directos = 60_000, overhead = 15_000, provisiones = 5_000, facturado = 120_000;
    const r = validateKPICoherence(
      devengado, directos, overhead, provisiones, facturado,
      devengado - directos,                            // ebitOperativo
      devengado - directos - overhead,                 // ebitEconomico
      facturado - directos - overhead - provisiones,   // ebitContable
      directos + overhead + provisiones,               // burnRate
      200_000, 80_000, 120_000                         // activo, pasivo, patrimonio
    );
    expect(r.isValid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  test('EBIT inflado dispara error', () => {
    const r = validateKPICoherence(
      100_000, 60_000, 15_000, 5_000, 120_000,
      45_000,  // ebitOperativo INCORRECTO (debería ser 40.000)
      25_000, 40_000, 80_000,
      200_000, 80_000, 120_000
    );
    expect(r.isValid).toBe(false);
    expect(r.errors.some(e => e.includes('EBIT Operativo'))).toBe(true);
  });

  test('patrimonio inconsistente dispara error', () => {
    const r = validateKPICoherence(
      100_000, 60_000, 15_000, 5_000, 120_000,
      40_000, 25_000, 40_000, 80_000,
      200_000, 80_000, 999_999 // patrimonio != activo - pasivo
    );
    expect(r.isValid).toBe(false);
    expect(r.errors.some(e => e.includes('Patrimonio'))).toBe(true);
  });
});
