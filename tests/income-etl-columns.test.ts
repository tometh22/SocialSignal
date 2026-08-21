/**
 * QA Suite: ingesta de "Proyectos confirmados y estimados"
 *
 * Dos bugs reales encontrados el 2026-08-21, ambos silenciosos durante meses:
 *
 *  1. El parser elegía la columna de importe con findIndex(includes('usd')).
 *     La solapa tiene TRES headers con "USD" y agarraba el primero, que está
 *     vacío en las filas facturadas en pesos: 66 de 109 filas de income_sot
 *     quedaron con revenue_usd = 0.
 *
 *  2. El ETL descartaba las filas con Pasado/Futuro = "Proyección", entre ellas
 *     la venta a Warner de USD 90.960 de septiembre-2026. income_sot no podía
 *     contener facturación futura.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveIncomeAmountColumns,
  isProjectionRow,
} from '../server/etl/proyectos-confirmados-spec';

// Headers exactos de la solapa, en su orden real.
const HEADERS = [
  'Mes Facturación', 'Año Facturación', 'Mes Cobro', 'Año', 'Cliente', 'Proyecto',
  'Tipo de proyecto', 'Confirmado', 'Propuesta enviada', 'Condición de pago',
  'Ajuste', 'Valor Base', 'Moneda Original ARS', 'Moneda Original USD',
  'IVA', 'IIBB', 'Cotización', 'Monto Total USD', 'Monto Total ARS CON IVA',
  'Monto Total USD CON IVA', 'Facturado/No Facturado', 'Pasado/Futuro',
];

describe('resolveIncomeAmountColumns', () => {
  it('distingue las tres columnas que contienen "USD"', () => {
    const cols = resolveIncomeAmountColumns(HEADERS);
    expect(HEADERS[cols.monedaUSD]).toBe('Moneda Original USD');
    expect(HEADERS[cols.montoTotalUSD]).toBe('Monto Total USD');
    expect(HEADERS[cols.cotizacion]).toBe('Cotización');
  });

  it('NO elige "Monto Total USD CON IVA" como importe neto', () => {
    const cols = resolveIncomeAmountColumns(HEADERS);
    expect(HEADERS[cols.montoTotalUSD]).not.toContain('CON IVA');
  });

  it('el importe no es la columna vacía en filas ARS', () => {
    // Reproduce el bug: findIndex(includes('usd')) devolvía 13
    // ("Moneda Original USD") en vez de 17 ("Monto Total USD").
    const ingenuo = HEADERS.findIndex((h) => h.toLowerCase().includes('usd'));
    const cols = resolveIncomeAmountColumns(HEADERS);
    expect(ingenuo).toBe(13);
    expect(cols.montoTotalUSD).toBe(17);
    expect(cols.montoTotalUSD).not.toBe(ingenuo);
  });

  it('devuelve -1 sin romper si falta un header', () => {
    const cols = resolveIncomeAmountColumns(['Cliente', 'Proyecto']);
    expect(cols.montoTotalUSD).toBe(-1);
    expect(cols.cotizacion).toBe(-1);
  });

  it('tolera headers nulos o vacíos en la fila', () => {
    const conHuecos = ['', null as any, 'Monto Total USD', undefined as any, 'Cotización'];
    const cols = resolveIncomeAmountColumns(conHuecos);
    expect(cols.montoTotalUSD).toBe(2);
    expect(cols.cotizacion).toBe(4);
  });
});

describe('isProjectionRow', () => {
  it('"Real" es facturación ejecutada', () => {
    expect(isProjectionRow('Real')).toBe(false);
    expect(isProjectionRow('  real  ')).toBe(false);
    expect(isProjectionRow('REAL')).toBe(false);
  });

  it('"Proyección" es proyección, con y sin acento', () => {
    // Es el valor de la fila de Warner: sep-2026, USD 90.960.
    expect(isProjectionRow('Proyección')).toBe(true);
    expect(isProjectionRow('Proyeccion')).toBe(true);
  });

  it('trata los valores rotos de la planilla como proyección', () => {
    // Hay 2 filas con #NUM! por fórmula rota. El supuesto conservador es que
    // no sumen a lo ejecutado.
    expect(isProjectionRow('#NUM!')).toBe(true);
    expect(isProjectionRow('')).toBe(true);
    expect(isProjectionRow(undefined)).toBe(true);
    expect(isProjectionRow(null)).toBe(true);
  });
});
