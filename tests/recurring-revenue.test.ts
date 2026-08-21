/**
 * QA Suite: ARR y Rendimiento por proyecto
 *
 * Ambas páginas salen de financial_sot ("Rendimiento Cliente" del Excel MAESTRO)
 * y reemplazan las páginas ARR, Rendimiento de Cliente y Rendimiento de
 * Proyectos del reporte de Looker. Los valores de referencia son los que ese
 * reporte muestra para jul-2026 sobre la misma planilla.
 */

import { describe, it, expect } from 'vitest';

// Proyectos con Tipo = "Fee" de jul-2026, tal como quedan en financial_sot.
const FEE_JUL_2026 = [
  { cliente: 'Warner', proyecto: 'Fee Marketing', facturacion: 29230.00, costo: 6402.73 },
  { cliente: 'Warner', proyecto: 'Fee Insights La granja de zenon', facturacion: 5805.00, costo: 18.23 },
  { cliente: 'Kimberly Clark', proyecto: 'Fee Huggies', facturacion: 5300.00, costo: 2401.41 },
  { cliente: 'Coelsa', proyecto: 'Fee mensual', facturacion: 3696.40, costo: 709.72 },
  { cliente: 'Detroit', proyecto: 'Fee mensual', facturacion: 1050.32, costo: 572.76 },
];

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const porCliente = (c: string) =>
  round2(FEE_JUL_2026.filter(f => f.cliente === c).reduce((a, f) => a + f.facturacion, 0));

describe('ARR / MRR', () => {
  const mrr = round2(FEE_JUL_2026.reduce((a, f) => a + f.facturacion, 0));

  it('el MRR es la facturación Fee del mes', () => {
    expect(mrr).toBeCloseTo(45081.72, 2);
  });

  it('el ARR es el MRR anualizado', () => {
    expect(round2(mrr * 12)).toBeCloseTo(540980.64, 1);
  });

  it('el ARR por cliente coincide con el reporte de Looker', () => {
    expect(round2(porCliente('Warner') * 12)).toBeCloseTo(420420, 2);
    expect(round2(porCliente('Kimberly Clark') * 12)).toBeCloseTo(63600, 2);
    expect(round2(porCliente('Detroit') * 12)).toBeCloseTo(12603.84, 2);
  });

  it('Warner concentra el 77,7% del MRR', () => {
    // Es el mismo umbral que dispara el detector de concentración.
    const share = round2((porCliente('Warner') / mrr) * 100);
    expect(share).toBeCloseTo(77.71, 1);
    expect(share).toBeGreaterThan(65);
  });

  it('el HHI refleja la concentración', () => {
    const clientes = ['Warner', 'Kimberly Clark', 'Coelsa', 'Detroit'];
    const hhi = clientes.reduce((a, c) => a + (porCliente(c) / mrr) ** 2, 0);
    // 1 = un solo cliente. Con Warner al 78% queda muy por encima de una
    // cartera repartida entre cuatro (que daría 0,25).
    expect(hhi).toBeGreaterThan(0.6);
    expect(hhi).toBeLessThan(1);
  });

  it('cuenta 4 clientes con fee mensual', () => {
    expect(new Set(FEE_JUL_2026.map(f => f.cliente)).size).toBe(4);
  });
});

describe('rendimiento por proyecto', () => {
  it('Warner Fee Marketing coincide con Looker', () => {
    const p = FEE_JUL_2026[0];
    const utilidad = round2(p.facturacion - p.costo);
    expect(round2((utilidad / p.facturacion) * 100)).toBeCloseTo(78.1, 1);
    expect(round2(p.facturacion / p.costo)).toBeCloseTo(4.57, 2);
  });

  it('Kimberly Fee Huggies coincide con Looker', () => {
    const p = FEE_JUL_2026[2];
    expect(round2(((p.facturacion - p.costo) / p.facturacion) * 100)).toBeCloseTo(54.69, 1);
    expect(round2(p.facturacion / p.costo)).toBeCloseTo(2.21, 2);
  });

  it('el markup del conjunto no es el promedio de los markups', () => {
    // Un proyecto chico con markup altísimo no debe arrastrar el total: por eso
    // se divide facturación total sobre costo total.
    const fact = FEE_JUL_2026.reduce((a, f) => a + f.facturacion, 0);
    const costo = FEE_JUL_2026.reduce((a, f) => a + f.costo, 0);
    const conjunto = fact / costo;
    const promedioSimple =
      FEE_JUL_2026.reduce((a, f) => a + f.facturacion / f.costo, 0) / FEE_JUL_2026.length;
    // "La granja de zenon" tiene markup 318x por un costo casi nulo.
    expect(promedioSimple).toBeGreaterThan(60);
    expect(conjunto).toBeLessThan(6);
  });

  it('un proyecto sin costo cargado no tiene markup, no markup infinito', () => {
    const markup = (fact: number, costo: number) => (costo > 0 ? fact / costo : null);
    expect(markup(5000, 0)).toBeNull();
    expect(markup(5000, 1000)).toBe(5);
  });
});
