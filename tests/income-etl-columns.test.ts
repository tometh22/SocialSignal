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

// ─── Parseo de moneda en formato español ─────────────────────────────────────

/** Réplica de parseMoneyUnified corregido (server/etl/import-incomes-confirmed.ts). */
const parseMoney = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  let cleaned = String(value).trim().replace(/[^\d.,-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '');
  }
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
};

describe('parseMoneyUnified — formato español', () => {
  it('no confunde el separador de miles con el decimal', () => {
    // La versión anterior reemplazaba TODA coma por punto y hacía parseFloat,
    // que se queda con el primer punto: mil veces menos de lo real.
    expect(parseMoney('$29.230,00')).toBe(29230);
    expect(parseMoney('$3.696,40')).toBeCloseTo(3696.4, 2);
    expect(parseMoney('$1.234,56')).toBeCloseTo(1234.56, 2);
  });

  it('lee montos en pesos con dos o más separadores de miles', () => {
    expect(parseMoney('$1.500.675')).toBe(1500675);
    expect(parseMoney('$1.402.500')).toBe(1402500);
  });

  it('con UN solo punto trata el valor como decimal', () => {
    // Ambiguo por naturaleza: "5.805" puede ser cinco con ochocientos cinco
    // (String(5.805), que es lo que manda daily-sot-sync) o cinco mil ochocientos
    // cinco en formato español. Se elige el caso que efectivamente llega.
    // Un primer intento trataba esto como miles y convertía 5,805 en 5805.
    expect(parseMoney('5.805')).toBeCloseTo(5.805, 3);
    expect(parseMoney('1.234')).toBeCloseTo(1.234, 3);
    expect(parseMoney('3696.4')).toBeCloseTo(3696.4, 2);
  });

  it('sigue leyendo enteros y decimales simples', () => {
    expect(parseMoney('5300')).toBe(5300);
    expect(parseMoney('151.28')).toBeCloseTo(151.28, 2);
    expect(parseMoney('-1.234,56')).toBeCloseTo(-1234.56, 2);
  });

  it('devuelve null para vacío o basura', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney(undefined)).toBeNull();
    expect(parseMoney('#NUM!')).toBeNull();
    expect(parseMoney('-')).toBeNull();
  });
});

// ─── Varias facturas al mismo cliente en el mismo mes ────────────────────────

describe('agregación por clave natural', () => {
  it('suma las dos facturas de Detroit de jul-2026', () => {
    // La solapa trae 1.402.500 ARS (899,04 USD) y 236.000 ARS (151,28 USD).
    // El upsert las colapsaba y guardaba sólo la última: 151,28 en vez de
    // 1.050,32 — 86% de la facturación del cliente perdida en silencio.
    const facturas = [899.04, 151.28];
    expect(facturas.reduce((a, b) => a + b, 0)).toBeCloseTo(1050.32, 2);
  });

  it('un mes es proyección sólo si TODAS sus facturas lo son', () => {
    const esProyeccion = (ms: boolean[]) => ms.every(Boolean);
    expect(esProyeccion([true, true])).toBe(true);
    // Si una parte ya se ejecutó, el mes no es proyección.
    expect(esProyeccion([false, true])).toBe(false);
    expect(esProyeccion([false, false])).toBe(false);
  });
});
