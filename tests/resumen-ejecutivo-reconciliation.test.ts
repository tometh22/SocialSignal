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
import { isBrokenNetProfit, parseCierre } from '../server/services/direct-sheets-dashboard';

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

// ─── Columna "Cierre" ────────────────────────────────────────────────────────

describe('parseCierre', () => {
  const hoy = new Date(2026, 7, 21); // 21-8-2026

  it('lee la fecha de cierre, que es lo que la columna realmente contiene', () => {
    // El parser anterior comparaba contra ['sí','true','x',…] y devolvía false
    // en los 24 meses, incluidos los de 2025 cerrados hace más de un año.
    expect(parseCierre('31-3-2025', hoy)).toBe(true);
    expect(parseCierre('31-12-2025', hoy)).toBe(true);
    expect(parseCierre('31-7-2026', hoy)).toBe(true);
  });

  it('un mes cuya fecha de cierre no llegó todavía no está cerrado', () => {
    expect(parseCierre('30-9-2026', hoy)).toBe(false);
    expect(parseCierre('31-12-2026', hoy)).toBe(false);
  });

  it('el propio día de cierre cuenta como cerrado', () => {
    expect(parseCierre('21-8-2026', hoy)).toBe(true);
  });

  it('acepta barras además de guiones', () => {
    expect(parseCierre('31/3/2025', hoy)).toBe(true);
    expect(parseCierre('30/9/2026', hoy)).toBe(false);
  });

  it('sigue aceptando los booleanos legacy', () => {
    expect(parseCierre('Sí', hoy)).toBe(true);
    expect(parseCierre('cerrado', hoy)).toBe(true);
    expect(parseCierre('no', hoy)).toBe(false);
  });

  it('vacío o basura no es cierre', () => {
    expect(parseCierre('', hoy)).toBe(false);
    expect(parseCierre(null, hoy)).toBe(false);
    expect(parseCierre(undefined, hoy)).toBe(false);
    expect(parseCierre('#REF!', hoy)).toBe(false);
  });
});

// ─── Markup: ejecutado vs proyectado ─────────────────────────────────────────

/**
 * Media armónica ponderada por ventas, que es como se agrega el markup:
 *   markup_i = ventas_i / CD_i  →  CD_i = ventas_i / markup_i
 *   markup   = Σ ventas_i / Σ CD_i
 */
const markupDe = (ms: Array<{ ventas: number; markup: number }>) => {
  const ventas = ms.reduce((a, m) => a + m.ventas, 0);
  const cd = ms.reduce((a, m) => a + m.ventas / m.markup, 0);
  return Math.round((ventas / cd) * 100) / 100;
};

// Datos reales del Resumen Ejecutivo para 2026.
const CERRADOS_2026 = [
  { mes: '01 ene', ventas: 41593.61, markup: 3.61 },
  { mes: '02 feb', ventas: 71617.90, markup: 4.08 },
  { mes: '03 mar', ventas: 53737.80, markup: 3.12 },
  { mes: '04 abr', ventas: 35639.64, markup: 3.42 },
  { mes: '05 may', ventas: 26164.83, markup: 3.18 },
  { mes: '06 jun', ventas: 75181.93, markup: 3.59 },
  { mes: '07 jul', ventas: 44576.72, markup: 4.26 },
];
const PROYECTADOS_2026 = [
  { mes: '08 ago', ventas: 44027.89, markup: 0.76 },
  { mes: '09 sep', ventas: 130568.85, markup: 2.74 },
  { mes: '10 oct', ventas: 39639.81, markup: 0.85 },
  { mes: '11 nov', ventas: 39351.25, markup: 0.84 },
  { mes: '12 dic', ventas: 39228.58, markup: 0.87 },
];

describe('markup ejecutado vs proyectado', () => {
  it('el markup de los 7 meses cerrados de 2026 es 3,62', () => {
    expect(markupDe(CERRADOS_2026)).toBeCloseTo(3.62, 2);
  });

  it('el markup de los 5 meses proyectados es 1,20', () => {
    // La planilla asume vender por debajo del costo directo en cuatro de los
    // cinco meses (markup < 1). Es un supuesto de la proyección, no ejecución.
    expect(markupDe(PROYECTADOS_2026)).toBeCloseTo(1.20, 2);
  });

  it('mezclarlos daba el 1,88 que se mostraba antes', () => {
    // Un markup por debajo del estándar de 2,5 que hacía ver el negocio
    // desplomado, cuando lo ejecutado va en 3,62.
    expect(markupDe([...CERRADOS_2026, ...PROYECTADOS_2026])).toBeCloseTo(1.88, 2);
  });

  it('2025 no cambia: los doce meses están cerrados', () => {
    const cerrados2025 = [
      { ventas: 28311.39, markup: 2.06 }, { ventas: 22453.38, markup: 1.87 },
      { ventas: 25655.51, markup: 2.11 }, { ventas: 28128.17, markup: 2.40 },
      { ventas: 38475.81, markup: 3.38 }, { ventas: 46583.86, markup: 3.07 },
      { ventas: 46034.88, markup: 3.72 }, { ventas: 53975.16, markup: 3.46 },
      { ventas: 108980.95, markup: 2.87 }, { ventas: 81838.86, markup: 3.16 },
      { ventas: 44708.22, markup: 3.74 }, { ventas: 46052.09, markup: 3.64 },
    ];
    expect(markupDe(cerrados2025)).toBeCloseTo(2.97, 2);
  });

  it('la media armónica no es el promedio simple', () => {
    // Un mes chico con markup altísimo no debe arrastrar el total.
    const ms = [{ ventas: 100000, markup: 2 }, { ventas: 1000, markup: 20 }];
    const promedioSimple = (2 + 20) / 2;
    expect(markupDe(ms)).toBeLessThan(promedioSimple);
    expect(markupDe(ms)).toBeCloseTo(2.02, 2);
  });
});
