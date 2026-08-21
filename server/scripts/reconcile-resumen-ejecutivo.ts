import { fetchResumenEjecutivoDirectly } from '../services/direct-sheets-dashboard';

/**
 * Reconciliación del informe económico-financiero contra el Excel MAESTRO.
 *
 * El dashboard lee la solapa "Resumen Ejecutivo" directamente, así que el
 * agregado anual tiene que ser exactamente la suma de las filas mensuales de la
 * planilla. Este script verifica esa identidad métrica por métrica.
 *
 * No usa cifras hardcodeadas: la verdad es la planilla en el momento de correr.
 * Un snapshot pegado en el código envejece — el 2026-08-21 comparar contra uno
 * del día anterior dio una diferencia de 87.658 que era sólo la venta a Warner
 * cargada en el medio.
 *
 * Lo que SÍ detecta es que el agregado invente, pierda o arrastre celdas rotas.
 *
 *   npx tsx server/scripts/reconcile-resumen-ejecutivo.ts [año...]
 */

const money = (n: number | null | undefined) =>
  n == null ? '—' : Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Metric = 'ventasDelMes' | 'ebitOperativo' | 'beneficioNeto';
const METRICS: Metric[] = ['ventasDelMes', 'ebitOperativo', 'beneficioNeto'];

export interface ReconciliationRow {
  year: number;
  metric: Metric;
  sheetSum: number | null;
  dashboard: number | null;
  diff: number | null;
  monthsInSheet: number;
  monthsCounted: number;
  ok: boolean;
}

export async function reconcileYear(year: number): Promise<{
  rows: ReconciliationRow[];
  brokenMonths: string[];
  monthsAggregated: number;
}> {
  const result: any = await fetchResumenEjecutivoDirectly(year, undefined, undefined, true);
  const months: any[] = (result.data || []).filter((m: any) => m.year === year);
  const agg: any = result.filtered || {};

  const rows: ReconciliationRow[] = METRICS.map((metric) => {
    // Sólo se suman los meses con valor. Las celdas rotas ya vienen en null
    // desde el parser, así que quedan fuera de los dos lados de la comparación.
    const values = months.map((m) => m[metric]).filter((v): v is number => v != null);
    const sheetSum = values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
    const dashboard = agg[metric] ?? null;
    const diff = sheetSum == null || dashboard == null ? null : dashboard - sheetSum;
    return {
      year,
      metric,
      sheetSum,
      dashboard,
      diff,
      monthsInSheet: months.length,
      monthsCounted: values.length,
      ok: diff != null && Math.abs(diff) < 0.01,
    };
  });

  return {
    rows,
    brokenMonths: agg.mesesSinBeneficioNeto ?? [],
    monthsAggregated: agg.mesesAgregados ?? months.length,
  };
}

const isDirectRun = process.argv[1]?.includes('reconcile-resumen-ejecutivo');
if (isDirectRun) {
  const years = process.argv.slice(2).map(Number).filter(Boolean);
  const target = years.length > 0 ? years : [new Date().getFullYear() - 1, new Date().getFullYear()];

  (async () => {
    let failures = 0;
    for (const year of target) {
      const { rows, brokenMonths, monthsAggregated } = await reconcileYear(year);
      console.log(`\n===== ${year} — ${monthsAggregated} meses agregados =====`);
      for (const r of rows) {
        const flag = r.ok ? '✅' : `❌ dif ${money(r.diff)}`;
        console.log(
          `  ${r.metric.padEnd(15)} planilla=${money(r.sheetSum).padStart(14)}  ` +
          `dashboard=${money(r.dashboard).padStart(14)}  ` +
          `(${r.monthsCounted}/${r.monthsInSheet} meses)  ${flag}`,
        );
        if (!r.ok) failures++;
      }
      if (brokenMonths.length > 0) {
        console.log(
          `  ⚠️  Beneficio Neto excluye ${brokenMonths.length} mes(es) con fórmula rota ` +
          `en la planilla: ${brokenMonths.join(', ')}`,
        );
        console.log(`      El total es PARCIAL. Corregir la fórmula en el Excel para cerrarlo.`);
      }
    }
    if (failures > 0) {
      console.error(`\n🔴 ${failures} métrica(s) no reconcilian contra la planilla.`);
      process.exit(1);
    }
    console.log('\n🟢 El informe reconcilia con el Excel MAESTRO.');
    process.exit(0);
  })().catch((err) => {
    console.error('❌ Reconciliación falló:', err?.message || err);
    process.exit(1);
  });
}
