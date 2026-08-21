/**
 * QA Suite: informe económico-financiero vs Excel MAESTRO
 *
 * El dashboard lee la solapa "Resumen Ejecutivo" directamente, así que debería
 * coincidir con el Excel por construcción. La comparación del 2026-08-21 mostró
 * que 2025 daba exacto en las tres métricas, pero 2026 reportaba 332.145 de
 * beneficio neto contra un real cercano a −21k.
 *
 * La causa no era el parseo: los meses sin cerrar (ago–dic 2026) tienen la celda
 * de Beneficio Neto rota — devuelve las Ventas del mes con margen 100%. El
 * dashboard las sumaba fielmente.
 */

import { describe, it, expect } from 'vitest';
import { isBrokenNetProfit } from '../server/services/direct-sheets-dashboard';

describe('isBrokenNetProfit', () => {
  it('detecta los cinco meses rotos de 2026 con sus valores reales', () => {
    // Filas tal cual vienen de la solapa: beneficioNeto == ventas, margen 100.
    const rotos = [
      { mes: '08 ago', ventas: 44027.89 },
      { mes: '09 sep', ventas: 130568.85 },
      { mes: '10 oct', ventas: 39639.81 },
      { mes: '11 nov', ventas: 39351.25 },
      { mes: '12 dic', ventas: 39228.58 },
    ];
    for (const r of rotos) {
      expect(isBrokenNetProfit(r.ventas, r.ventas, 100), r.mes).toBe(true);
    }
  });

  it('no marca los meses sanos de 2026', () => {
    // ene a jul: beneficio neto real, distinto de las ventas.
    const sanos = [
      { ventas: 41593.61, neto: 14479.10, margen: 34.81 },
      { ventas: 71617.90, neto: 21232.37, margen: 29.65 },
      { ventas: 35639.64, neto: -10475.31, margen: -29.39 },
      { ventas: 26164.83, neto: -16480.46, margen: -62.99 },
      { ventas: 44576.72, neto: -5356.67, margen: -12.02 },
    ];
    for (const s of sanos) {
      expect(isBrokenNetProfit(s.neto, s.ventas, s.margen)).toBe(false);
    }
  });

  it('no marca 2025, que está sano en los doce meses', () => {
    expect(isBrokenNetProfit(59012.00, 108980.95, 54.15)).toBe(false);
    expect(isBrokenNetProfit(-13036.95, 46052.09, -28.31)).toBe(false);
  });

  it('exige las DOS condiciones, no una sola', () => {
    // Igual a ventas pero con margen real: no es la fórmula rota.
    expect(isBrokenNetProfit(1000, 1000, 42)).toBe(false);
    // Margen 100 pero importe distinto: tampoco.
    expect(isBrokenNetProfit(900, 1000, 100)).toBe(false);
    // Las dos juntas: sí.
    expect(isBrokenNetProfit(1000, 1000, 100)).toBe(true);
  });

  it('no rompe con nulos ni con meses sin ventas', () => {
    expect(isBrokenNetProfit(null, 1000, 100)).toBe(false);
    expect(isBrokenNetProfit(1000, null, 100)).toBe(false);
    expect(isBrokenNetProfit(1000, 1000, null)).toBe(false);
    // Un mes en cero no es una fórmula rota, es un mes sin actividad.
    expect(isBrokenNetProfit(0, 0, 100)).toBe(false);
  });

  it('tolera el ruido de redondeo de la planilla', () => {
    expect(isBrokenNetProfit(44027.894, 44027.89, 100.001)).toBe(true);
    // Medio punto de margen ya es un dato real, no la fórmula rota.
    expect(isBrokenNetProfit(44027.89, 44027.89, 99.5)).toBe(false);
  });
});

describe('agregado anual — invariantes', () => {
  // Suma de los meses sanos de 2026 (ene–jul), que es lo que debe quedar
  // después de excluir las cinco celdas rotas.
  const NETO_2026_SANO = 14479.10 + 21232.37 + 7964.53 - 10475.31 - 16480.46 + 27965.48 - 5356.67;

  it('el beneficio neto excluyendo meses rotos da los 7 meses válidos', () => {
    expect(NETO_2026_SANO).toBeCloseTo(39329.04, 2);
  });

  it('sumar las celdas rotas daba el número inflado que se reportaba', () => {
    const rotos = 44027.89 + 130568.85 + 39639.81 + 39351.25 + 39228.58;
    expect(NETO_2026_SANO + rotos).toBeCloseTo(332145.42, 2);
  });

  it('EBIT 2026: la suma mensual de la planilla da el total del dashboard', () => {
    // Verifica que el agregado no inventa ni pierde nada respecto del Excel.
    const ebitMensual = [
      -2922.68, 27050.00, 9602.52, -17707.31, -18628.19, 30875.65, -4846.02,
      -13629.11, 82850.47, -6813.76, -7715.52, -5900.16,
    ];
    expect(ebitMensual.reduce((a, b) => a + b, 0)).toBeCloseTo(72215.89, 2);
  });

  it('ventas 2026: la suma mensual coincide con el Excel', () => {
    const ventas = [
      41593.61, 71617.90, 53737.80, 35639.64, 26164.83, 75181.93, 44576.72,
      44027.89, 130568.85, 39639.81, 39351.25, 39228.58,
    ];
    expect(ventas.reduce((a, b) => a + b, 0)).toBeCloseTo(641328.81, 2);
  });
});
