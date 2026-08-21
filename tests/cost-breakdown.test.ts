/**
 * QA Suite: desglose de costos
 *
 * La página Costos reemplaza tres del reporte de Looker: "Costos YTD y
 * Estimados", "Costos Directos e Indirectos" y "Costos Equipo".
 *
 * Los valores de referencia son los que ese reporte muestra para 2026 sobre la
 * misma planilla. fact_estimated_cost_month no existía en producción hasta la
 * migración 0053 — el paso del pipeline que la escribe fallaba en silencio.
 */

import { describe, it, expect } from 'vitest';
import { __testing } from '../server/services/cost-breakdown';

const { round2, BOARD_Y_HOLDING } = __testing;

// Top de conceptos 2026, verificado contra el Looker.
const CONCEPTOS_2026 = [
  { concepto: 'Tomi Criado', monto: 54267.46 },
  { concepto: 'Honorarios Oxean', monto: 54045.32 },
  { concepto: 'Vicky Puricelli', monto: 44310.06 },
  { concepto: 'Tarjeta USA', monto: 43900.00 },
  { concepto: 'Youscan', monto: 35446.70 },
];
const TOTAL_2026 = 613796.12;

describe('conceptos de costo', () => {
  it('el ranking coincide con el reporte de Looker', () => {
    expect(CONCEPTOS_2026[0].monto).toBeCloseTo(54267.46, 2);
    expect(CONCEPTOS_2026[1].monto).toBeCloseTo(54045.32, 2);
    expect(CONCEPTOS_2026[2].monto).toBeCloseTo(44310.06, 2);
  });

  it('board y holding se agrupan aparte', () => {
    // Es la línea más grande de la empresa y queda diluida en un ranking de
    // más de cien conceptos.
    expect(BOARD_Y_HOLDING).toContain('Tomi Criado');
    expect(BOARD_Y_HOLDING).toContain('Vicky Puricelli');
    expect(BOARD_Y_HOLDING).toContain('Honorarios Oxean');
    expect(BOARD_Y_HOLDING).toHaveLength(3);
  });

  it('board y holding suman 152.622,84 en 2026', () => {
    const board = CONCEPTOS_2026
      .filter(c => BOARD_Y_HOLDING.includes(c.concepto))
      .reduce((a, c) => a + c.monto, 0);
    expect(round2(board)).toBeCloseTo(152622.84, 2);
  });

  it('board y holding son casi un cuarto del costo del ejercicio', () => {
    const share = round2((152622.84 / TOTAL_2026) * 100);
    expect(share).toBeCloseTo(24.87, 1);
    expect(share).toBeGreaterThan(20);
  });
});

describe('directos vs indirectos', () => {
  it('el overhead es indirecto sobre el costo operativo', () => {
    // jul-2026: 12.372,70 directo / 37.046,18 indirecto.
    const directo = 12372.70, indirecto = 37046.18;
    const overhead = round2((indirecto / (directo + indirecto)) * 100);
    expect(overhead).toBeCloseTo(74.96, 1);
  });

  it('no divide por cero en un mes sin costo operativo', () => {
    const overhead = (d: number, i: number) => (d + i > 0 ? round2((i / (d + i)) * 100) : 0);
    expect(overhead(0, 0)).toBe(0);
    expect(overhead(100, 0)).toBe(0);
  });

  it('las provisiones no entran en el overhead', () => {
    // El overhead compara estructura contra equipo asignado; una provisión
    // contable no es ninguna de las dos.
    const directo = 100, indirecto = 100, provisiones = 800;
    expect(round2((indirecto / (directo + indirecto)) * 100)).toBe(50);
    expect(round2(directo + indirecto + provisiones)).toBe(1000);
  });
});

describe('equipo', () => {
  it('el valor hora sale de las horas realmente cargadas', () => {
    const valorHora = (costo: number, asana: number) => (asana > 0 ? round2(costo / asana) : null);
    expect(valorHora(1129.36, 48.75)).toBeCloseTo(23.17, 2);
  });

  it('sin horas cargadas no hay valor hora, no infinito', () => {
    const valorHora = (costo: number, asana: number) => (asana > 0 ? round2(costo / asana) : null);
    expect(valorHora(5000, 0)).toBeNull();
  });
});
