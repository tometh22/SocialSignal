/**
 * QA Suite: Financial Intelligence
 *
 * Estos tests son la traducción a código de los hallazgos del análisis financiero
 * del 2026-08-20. Cada bloque documenta el caso real que lo motivó, para que el
 * dashboard no pueda volver a perder esa señal sin que falle el build.
 */

import { describe, it, expect } from 'vitest';
import { addMonths, monthSpan, monthRange } from '../server/services/dates';
import {
  allocateEvent,
  resolveCollectionPeriod,
  __testing,
  type RevenueEventInput,
} from '../server/services/revenue-basis';
import {
  buildEbitBridge,
  buildResultLine,
  applyOneOffs,
  buildCoverage,
} from '../server/services/financial-intelligence';

const { distribute } = __testing;

// ─── Aritmética de períodos ──────────────────────────────────────────────────

describe('aritmética de períodos', () => {
  it('suma meses cruzando el año', () => {
    expect(addMonths('2026-09', 3)).toBe('2026-12');
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
  });

  it('resta meses cruzando el año', () => {
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2026-02', -3)).toBe('2025-11');
  });

  it('cuenta el span inclusive de ambos extremos', () => {
    // El proyecto Warner nuevo: sep-2026 a ago-2027 son 12 meses, no 11.
    expect(monthSpan('2026-09', '2027-08')).toBe(12);
    expect(monthSpan('2026-09', '2026-09')).toBe(1);
  });

  it('genera el rango completo', () => {
    expect(monthRange('2026-09', '2026-12')).toEqual(['2026-09', '2026-10', '2026-11', '2026-12']);
    expect(monthRange('2026-12', '2026-09')).toEqual([]);
  });
});

// ─── Reparto sin pérdida de centavos ─────────────────────────────────────────

describe('distribute', () => {
  it('nunca pierde ni inventa centavos', () => {
    // 100 / 3 no es exacto: la última cuota tiene que absorber el remanente.
    const out = distribute(100, ['2026-01', '2026-02', '2026-03'], [1, 1, 1]);
    const total = out.reduce((a, r) => a + r.amountUsd, 0);
    expect(Number(total.toFixed(2))).toBe(100);
  });

  it('reparte proporcional a los pesos', () => {
    const out = distribute(1000, ['2026-01', '2026-02'], [3, 1]);
    expect(out[0].amountUsd).toBe(750);
    expect(out[1].amountUsd).toBe(250);
  });

  it('cae a partes iguales si los pesos suman cero', () => {
    const out = distribute(900, ['2026-01', '2026-02', '2026-03'], [0, 0, 0]);
    expect(out.map((r) => r.amountUsd)).toEqual([300, 300, 300]);
  });
});

// ─── El caso Warner ──────────────────────────────────────────────────────────

describe('venta Warner 90k — el caso que originó todo', () => {
  // Venta confirmada de USD 90.000, facturable en septiembre-2026, entregada
  // de sep-2026 a ago-2027, cobrable a 90 días.
  const warner: RevenueEventInput = {
    clientName: 'Warner',
    projectName: 'Fee Insights',
    amountUsd: 90000,
    invoicePeriod: '2026-09',
    deliveryStart: '2026-09',
    deliveryEnd: '2027-08',
    deliveryCurve: 'linear',
    paymentTermsDays: 90,
  };

  const periods2026 = monthRange('2026-01', '2026-12');
  const sum = (allocs: { periodKey: string; amountUsd: number }[], keys: string[]) =>
    allocs.filter((a) => keys.includes(a.periodKey)).reduce((acc, a) => acc + a.amountUsd, 0);

  it('facturación pone los 90k enteros en septiembre', () => {
    const out = allocateEvent(warner, 'facturacion');
    expect(out).toEqual([{ periodKey: '2026-09', amountUsd: 90000 }]);
  });

  it('devengado deja 30k en 2026 y 60k en 2027', () => {
    // 12 meses de entrega, 4 de ellos en 2026 = un tercio.
    const out = allocateEvent(warner, 'devengado');
    expect(out).toHaveLength(12);
    expect(sum(out, periods2026)).toBe(30000);
    expect(sum(out, monthRange('2027-01', '2027-08'))).toBe(60000);
  });

  it('cobranza cae en 2027, no en 2026', () => {
    // 90 días desde septiembre = diciembre por contrato. Pero el histórico de
    // Warner (INVOICE 636 y 642, emitidas 2 y 15/9/2025, vencidas 1 y 14/12/2025)
    // muestra cobro efectivo el 7/1/2026. Con cobro real cargado, manda el real.
    expect(resolveCollectionPeriod(warner)).toBe('2026-12');
    expect(resolveCollectionPeriod({ ...warner, collectionPeriodActual: '2027-01' })).toBe('2027-01');
  });

  it('la diferencia entre bases es exactamente el resultado adelantado', () => {
    const facturacion = sum(allocateEvent(warner, 'facturacion'), periods2026);
    const devengado = sum(allocateEvent(warner, 'devengado'), periods2026);
    expect(facturacion - devengado).toBe(60000);
  });
});

// ─── Seguridad de la migración ───────────────────────────────────────────────

describe('degradación segura', () => {
  // El Excel hoy no tiene fechas de entrega. Hasta que Operaciones las cargue,
  // el devengado tiene que colapsar al mes de factura para que migrar no mueva
  // ni un número.
  const sinEntrega: RevenueEventInput = {
    clientName: 'Kimberly Clark',
    amountUsd: 5300,
    invoicePeriod: '2026-10',
  };

  it('sin fechas de entrega, devengado == facturación', () => {
    expect(allocateEvent(sinEntrega, 'devengado')).toEqual(
      allocateEvent(sinEntrega, 'facturacion'),
    );
  });

  it('curve invoice explícito también colapsa', () => {
    const e = { ...sinEntrega, deliveryCurve: 'invoice' as const, deliveryStart: '2026-10', deliveryEnd: '2026-12' };
    expect(allocateEvent(e, 'devengado')).toEqual([{ periodKey: '2026-10', amountUsd: 5300 }]);
  });

  it('sin términos ni cobro declarado, cobranza == facturación', () => {
    expect(resolveCollectionPeriod(sinEntrega)).toBe('2026-10');
  });

  it('rango de entrega invertido no rompe: cae al mes de factura', () => {
    const roto = { ...sinEntrega, deliveryCurve: 'linear' as const, deliveryStart: '2026-12', deliveryEnd: '2026-09' };
    expect(allocateEvent(roto, 'devengado')).toEqual([{ periodKey: '2026-10', amountUsd: 5300 }]);
  });
});

// ─── Método de input ─────────────────────────────────────────────────────────

describe('devengado por método de input', () => {
  const evento: RevenueEventInput = {
    clientName: 'Warner',
    projectId: 42,
    amountUsd: 12000,
    invoicePeriod: '2026-09',
    deliveryStart: '2026-09',
    deliveryEnd: '2026-11',
    deliveryCurve: 'input_method',
  };

  it('reparte según las horas reales, no lineal', () => {
    // El esfuerzo de un proyecto de research no es lineal: hay setup al inicio
    // y análisis al final. Con horas cargadas hay que respetarlas.
    const horas = new Map([['2026-09', 100], ['2026-10', 50], ['2026-11', 50]]);
    const out = allocateEvent(evento, 'devengado', horas);
    expect(out.map((o) => o.amountUsd)).toEqual([6000, 3000, 3000]);
  });

  it('cae a lineal si no hay horas cargadas', () => {
    const out = allocateEvent(evento, 'devengado', new Map());
    expect(out.map((o) => o.amountUsd)).toEqual([4000, 4000, 4000]);
  });

  it('cae a lineal si las horas están todas en cero', () => {
    const horas = new Map([['2026-09', 0], ['2026-10', 0], ['2026-11', 0]]);
    const out = allocateEvent(evento, 'devengado', horas);
    expect(out.map((o) => o.amountUsd)).toEqual([4000, 4000, 4000]);
  });
});

// ─── Términos de pago ────────────────────────────────────────────────────────

describe('resolveCollectionPeriod', () => {
  const base: RevenueEventInput = { clientName: 'X', amountUsd: 1000, invoicePeriod: '2026-09' };

  it('redondea los términos hacia arriba', () => {
    // Una factura a 90 días emitida a mitad de mes entra el mes 4, no el 3.
    // Subestimar esto es lo que hace que un cobro "de diciembre" caiga en enero.
    expect(resolveCollectionPeriod({ ...base, paymentTermsDays: 90 })).toBe('2026-12');
    expect(resolveCollectionPeriod({ ...base, paymentTermsDays: 100 })).toBe('2027-01');
    expect(resolveCollectionPeriod({ ...base, paymentTermsDays: 30 })).toBe('2026-10');
  });

  it('prioriza cobro real sobre esperado', () => {
    const e = { ...base, collectionPeriodExpected: '2026-12', collectionPeriodActual: '2027-01' };
    expect(resolveCollectionPeriod(e)).toBe('2027-01');
  });
});

// ─── El puente: ¿es venta o es gasto? ────────────────────────────────────────

describe('buildEbitBridge', () => {
  it('atribuye el 86% del derrumbe 2025→2026 al costo, no a la venta', () => {
    // Cifras verificadas contra el Resumen Ejecutivo del MAESTRO.
    // Esta es la pregunta que se contestó mal a ojo antes de tener el puente.
    const bridge = buildEbitBridge(
      { label: '2025', devengado: 571_198, directos: 435_727, overhead: 0 },
      { label: '2026', devengado: 550_369, directos: 565_811, overhead: 0 },
    );

    expect(bridge.fromEbitUsd).toBeCloseTo(135_471, 0);
    expect(bridge.toEbitUsd).toBeCloseTo(-15_442, 0);
    expect(bridge.deltaUsd).toBeCloseTo(-150_913, 0);

    expect(bridge.dominantDriver).toBe('Costo directo');
    expect(bridge.dominantSharePct).toBeCloseTo(86.2, 1);

    const ingreso = bridge.effects.find((e) => e.label === 'Ingreso')!;
    expect(ingreso.amountUsd).toBeCloseTo(-20_829, 0);
    expect(ingreso.sharePct).toBeCloseTo(13.8, 1);
  });

  it('los efectos suman exactamente la variación del EBIT', () => {
    const bridge = buildEbitBridge(
      { label: 'a', devengado: 100, directos: 40, overhead: 10 },
      { label: 'b', devengado: 130, directos: 55, overhead: 5 },
    );
    const suma = bridge.effects.reduce((a, e) => a + e.amountUsd, 0);
    expect(suma).toBeCloseTo(bridge.deltaUsd, 6);
  });

  it('atribuye a la venta cuando el costo no se mueve', () => {
    const bridge = buildEbitBridge(
      { label: 'a', devengado: 100, directos: 50, overhead: 0 },
      { label: 'b', devengado: 60, directos: 50, overhead: 0 },
    );
    expect(bridge.dominantDriver).toBe('Ingreso');
    expect(bridge.dominantSharePct).toBe(100);
  });
});

// ─── Beneficio neto ──────────────────────────────────────────────────────────

describe('buildResultLine', () => {
  it('separa EBIT de beneficio neto', () => {
    // El tablero vivía sólo en EBIT, que excluye impuestos e intereses de Oxean
    // — justo el costo de la deuda que se estaba por tomar.
    const r = buildResultLine({
      devengado: 550_369, facturacion: 640_369, cobranza: 500_000,
      directos: 400_000, overhead: 165_811, provisiones: 5_400,
    });
    expect(r.ebitUsd).toBeCloseTo(-15_442, 0);
    expect(r.beneficioNetoUsd).toBeCloseTo(-20_842, 0);
    expect(r.beneficioNetoUsd).toBeLessThan(r.ebitUsd);
  });

  it('no divide por cero sin devengado', () => {
    const r = buildResultLine({
      devengado: 0, facturacion: 0, cobranza: 0,
      directos: 1000, overhead: 0, provisiones: 0,
    });
    expect(r.margenEbitPct).toBe(0);
    expect(r.margenNetoPct).toBe(0);
  });
});

// ─── Partidas no recurrentes ─────────────────────────────────────────────────

describe('applyOneOffs', () => {
  it('descuenta la reversión de bonos de 18k del resultado reportado', () => {
    // La provisión de bonos de dic-2025 se revirtió como ingreso en ene-2026.
    // Sin limpiarla, 2026 parece muy superior a 2025 cuando queda casi igual.
    const limpio = applyOneOffs(75_600, [
      { periodKey: '2026-01', concept: 'Reversión provisión bonos dic-2025', amountUsd: 18_000, affects: 'cost' },
    ]);
    expect(limpio.cleanUsd).toBe(57_600);
    expect(limpio.oneOffsUsd).toBe(18_000);
  });

  it('sin partidas, el limpio es el reportado', () => {
    expect(applyOneOffs(54_197, []).cleanUsd).toBe(54_197);
  });

  it('acumula varias partidas con signos distintos', () => {
    const limpio = applyOneOffs(100_000, [
      { periodKey: '2026-01', concept: 'a', amountUsd: 18_000, affects: 'cost' },
      { periodKey: '2026-06', concept: 'b', amountUsd: -5_000, affects: 'revenue' },
    ]);
    expect(limpio.cleanUsd).toBe(87_000);
  });
});

// ─── Cobertura hacia adelante ────────────────────────────────────────────────

describe('buildCoverage', () => {
  it('muestra el hueco real de sep-dic 2026: -9k por mes', () => {
    // "Cómo quedan gastos vs ventas los próximos meses" quedó sin contestar en
    // el board, y la respuesta que circuló fue "break-even". No lo era.
    const cobertura = buildCoverage([
      { periodKey: '2026-09', revenueUsd: 39_608.85, costUsd: 47_614 },
      { periodKey: '2026-10', revenueUsd: 39_639.81, costUsd: 56_943.26 },
      { periodKey: '2026-11', revenueUsd: 39_351.25, costUsd: 47_000.45 },
      { periodKey: '2026-12', revenueUsd: 39_228.58, costUsd: 44_912.45 },
    ]);
    expect(cobertura.totalGapUsd).toBeCloseTo(-38_641.67, 2);
    expect(cobertura.avgMonthlyGapUsd).toBeLessThan(-9_000);
    expect(cobertura.months.every((m) => m.coverageRatio < 1)).toBe(true);
  });

  it('marca cobertura >= 1 cuando el ingreso cubre el costo', () => {
    const cobertura = buildCoverage([{ periodKey: '2026-06', revenueUsd: 75_182, costUsd: 44_306 }]);
    expect(cobertura.months[0].coverageRatio).toBeGreaterThan(1);
    expect(cobertura.totalGapUsd).toBeGreaterThan(0);
  });

  it('tolera una lista vacía', () => {
    expect(buildCoverage([]).avgMonthlyGapUsd).toBe(0);
  });
});
