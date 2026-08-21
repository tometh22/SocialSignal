/**
 * QA Suite: Detectores de calidad de dato
 *
 * Cada test reproduce, con las cifras reales del análisis del 2026-08-20, algo
 * que el dashboard no señalaba y que hubo que encontrar leyendo la planilla a
 * mano. Si un detector deja de disparar en su caso, el build falla.
 */

import { describe, it, expect } from 'vitest';
import {
  detectBasisDivergence,
  detectRevenueConcentration,
  detectForwardCoverageCliff,
  detectZeroedProjectionLines,
  detectProvisionReversals,
  detectDsoDrift,
  detectEmptyPipeline,
  detectCostConcentration,
} from '../server/services/data-quality';

describe('basis_divergence', () => {
  it('dispara con el caso Warner: 641k facturación vs 581k devengado', () => {
    const [f] = detectBasisDivergence(2026, 641_000, 581_000);
    expect(f).toBeDefined();
    expect(f.detector).toBe('basis_divergence');
    expect(f.delta).toBe(60_000);
    expect(f.detail).toContain('resultado de ejercicios futuros');
  });

  it('no dispara cuando las bases coinciden', () => {
    expect(detectBasisDivergence(2025, 571_198, 571_198)).toHaveLength(0);
  });

  it('no dispara por diferencias inmateriales', () => {
    expect(detectBasisDivergence(2026, 641_000, 640_500)).toHaveLength(0);
  });

  it('detecta también el caso inverso: se entrega más de lo que se factura', () => {
    const [f] = detectBasisDivergence(2027, 100_000, 160_000);
    expect(f.detail).toContain('pendiente de facturar');
    expect(f.delta).toBe(-60_000);
  });
});

describe('revenue_concentration', () => {
  // Composición real de sep-dic 2026 según el MAESTRO.
  const clientes = [
    { clientName: 'Warner', amountUsd: 29_230 },
    { clientName: 'Kimberly Clark', amountUsd: 5_300 },
    { clientName: 'Coelsa', amountUsd: 3_900 },
    { clientName: 'Detroit', amountUsd: 950 },
  ];

  it('marca a Warner como crítico al 74%', () => {
    const [f] = detectRevenueConcentration(clientes, 'sep-dic 2026');
    expect(f.entity).toBe('Warner');
    expect(f.severity).toBe('critical');
    expect(f.title).toContain('74');
  });

  it('no dispara con una cartera repartida', () => {
    const repartida = [
      { clientName: 'A', amountUsd: 100 },
      { clientName: 'B', amountUsd: 100 },
      { clientName: 'C', amountUsd: 100 },
    ];
    expect(detectRevenueConcentration(repartida, 'test')).toHaveLength(0);
  });

  it('tolera una cartera vacía', () => {
    expect(detectRevenueConcentration([], 'test')).toHaveLength(0);
  });
});

describe('forward_coverage_cliff', () => {
  it('dispara con el horizonte real: cargado hasta 2027-05 estando en 2026-08', () => {
    const [f] = detectForwardCoverageCliff('2027-05', '2026-08');
    expect(f).toBeDefined();
    expect(f.actualValue).toBe(9);
    expect(f.severity).toBe('warning');
  });

  it('escala a crítico con seis meses o menos', () => {
    const [f] = detectForwardCoverageCliff('2027-02', '2026-08');
    expect(f.actualValue).toBe(6);
    expect(f.severity).toBe('critical');
  });

  it('es crítico si no hay nada cargado', () => {
    const [f] = detectForwardCoverageCliff(null, '2026-08');
    expect(f.severity).toBe('critical');
  });

  it('no dispara con horizonte holgado', () => {
    expect(detectForwardCoverageCliff('2028-01', '2026-08')).toHaveLength(0);
  });
});

describe('zeroed_projection_line', () => {
  it('detecta Impuestos USA en cero mientras devenga en los meses reales', () => {
    const [f] = detectZeroedProjectionLines([
      { concept: 'Impuestos USA', actualAvgUsd: 2_000, projectedTotalUsd: 0, projectedMonths: 5 },
    ]);
    expect(f).toBeDefined();
    expect(f.expectedValue).toBe(10_000);
    expect(f.title).toContain('Impuestos USA');
  });

  it('ignora conceptos que legítimamente son chicos', () => {
    expect(detectZeroedProjectionLines([
      { concept: 'Ianece Leandro', actualAvgUsd: 70, projectedTotalUsd: 0, projectedMonths: 5 },
    ])).toHaveLength(0);
  });

  it('no dispara si el concepto sí está proyectado', () => {
    expect(detectZeroedProjectionLines([
      { concept: 'Honorarios Oxean', actualAvgUsd: 4_500, projectedTotalUsd: 22_500, projectedMonths: 5 },
    ])).toHaveLength(0);
  });
});

describe('provision_reversal', () => {
  it('detecta la provisión de bonos de dic-2025 revertida en ene-2026', () => {
    const [f] = detectProvisionReversals([
      { periodKey: '2025-11', provisionsUsd: 0 },
      { periodKey: '2025-12', provisionsUsd: 18_000 },
      { periodKey: '2026-01', provisionsUsd: -18_000 },
      { periodKey: '2026-02', provisionsUsd: 0 },
    ]);
    expect(f).toBeDefined();
    expect(f.periodKey).toBe('2026-01');
    expect(f.delta).toBe(18_000);
    expect(f.detail).toContain('one_off_items');
  });

  it('no confunde una serie de provisiones normales con una reversión', () => {
    expect(detectProvisionReversals([
      { periodKey: '2026-01', provisionsUsd: 5_000 },
      { periodKey: '2026-02', provisionsUsd: 5_200 },
      { periodKey: '2026-03', provisionsUsd: 4_800 },
    ])).toHaveLength(0);
  });

  it('ignora reversiones parciales chicas', () => {
    expect(detectProvisionReversals([
      { periodKey: '2026-01', provisionsUsd: 18_000 },
      { periodKey: '2026-02', provisionsUsd: -2_000 },
    ])).toHaveLength(0);
  });
});

describe('dso_drift', () => {
  it('detecta que Warner cobra a 115 días contra 90 contractuales', () => {
    const [f] = detectDsoDrift([
      { clientName: 'Warner', contractualDays: 90, observedDays: 115, sampleSize: 4 },
    ]);
    expect(f).toBeDefined();
    expect(f.delta).toBe(25);
    expect(f.detail).toContain('plazo observado');
  });

  it('no dispara con una sola factura de muestra', () => {
    expect(detectDsoDrift([
      { clientName: 'X', contractualDays: 30, observedDays: 120, sampleSize: 1 },
    ])).toHaveLength(0);
  });

  it('no dispara si el cliente paga en fecha', () => {
    expect(detectDsoDrift([
      { clientName: 'Coelsa', contractualDays: 30, observedDays: 32, sampleSize: 6 },
    ])).toHaveLength(0);
  });
});

describe('empty_pipeline', () => {
  it('dispara con las 111 filas confirmadas y ninguna en pipeline', () => {
    const [f] = detectEmptyPipeline(111, 0);
    expect(f).toBeDefined();
    expect(f.detail).toContain('no se cierra nada nuevo');
  });

  it('no dispara si hay pipeline cargado', () => {
    expect(detectEmptyPipeline(111, 7)).toHaveLength(0);
  });

  it('no dispara en una base vacía', () => {
    expect(detectEmptyPipeline(0, 0)).toHaveLength(0);
  });
});

describe('cost_concentration', () => {
  it('expone la línea de board + holding al 27,7% de la facturación', () => {
    const findings = detectCostConcentration(
      [{ concept: 'Board + Honorarios Oxean', amountUsd: 152_622 }],
      550_369,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('27.7%');
  });

  it('ignora conceptos por debajo del umbral', () => {
    expect(detectCostConcentration(
      [{ concept: 'Youscan', amountUsd: 46_081 }],
      550_369,
    )).toHaveLength(0);
  });
});
