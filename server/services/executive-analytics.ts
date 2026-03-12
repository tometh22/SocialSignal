import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface TrendPoint {
  month: string;
  value: number;
}

export interface TrendData {
  months: string[];
  values: number[];
}

export interface DiffData {
  vsPrevMonth: number | null;
  vs3mAvg: number | null;
}

export interface Alert {
  type: 'critical' | 'warning' | 'info';
  message: string;
  metric: string;
}

export interface BreakdownItem {
  label: string;
  value: number;
  pct: number;
}

export interface MultiSeriesTrend {
  months: string[];
  series: { [key: string]: number[] };
}

function getPreviousPeriods(periodKey: string, count: number): string[] {
  const [year, month] = periodKey.split('-').map(Number);
  const periods: string[] = [];
  
  for (let i = 1; i <= count; i++) {
    let prevMonth = month - i;
    let prevYear = year;
    while (prevMonth <= 0) {
      prevMonth += 12;
      prevYear -= 1;
    }
    periods.push(`${prevYear}-${String(prevMonth).padStart(2, '0')}`);
  }
  
  return periods;
}

function calcDiff(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function calcDiffVs3mAvg(current: number, last3: number[]): number | null {
  // FIX: Only exclude exact zero (no data), not negatives (valid negative EBIT/margins)
  // Before: filter(v => v > 0) excluded negative months, corrupting the average
  const validValues = last3.filter(v => v !== 0);
  if (validValues.length === 0) return null;
  const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
  if (avg === 0) return null;
  return ((current - avg) / Math.abs(avg)) * 100;
}

export async function getOperativoTrendsAndDiffs(periodKey: string): Promise<{
  trends: {
    devengado: TrendData;
    ebitOperativo: TrendData;
    margenOperativo: TrendData;
    tarifaEfectiva: TrendData;
    horas: MultiSeriesTrend;
  };
  diffs: {
    devengado: DiffData;
    ebitOperativo: DiffData;
    tarifaEfectiva: DiffData;
    markup: DiffData;
    directos: DiffData;
  };
  alerts: Alert[];
  breakdowns: {
    horasDistribucion: BreakdownItem[];
    horasPorPersona: BreakdownItem[];
    horasPorProyecto: BreakdownItem[];
  };
}> {
  const prev12 = getPreviousPeriods(periodKey, 11);
  const allPeriods = [...prev12.reverse(), periodKey];
  
  // FIX: Usar fact_rc_month como source of truth para devengado (consistente con KPI cards)
  // Antes se usaba monthly_financial_summary.facturacion_total - pasivo_facturacion_adelantada
  // lo cual daba valores distintos a los KPI cards que usan fact_rc_month.revenue_usd
  const { rows: revenueRows } = await pool.query(`
    SELECT period_key, COALESCE(SUM(revenue_usd), 0) as devengado_usd
    FROM fact_rc_month
    WHERE period_key = ANY($1)
    GROUP BY period_key
  `, [allPeriods]);
  const revByPeriod = new Map(revenueRows.map((r: any) => [r.period_key, parseFloat(r.devengado_usd)]));

  const { rows: costsRows } = await pool.query(`
    SELECT period_key, COALESCE(SUM(direct_usd), 0) as direct_usd
    FROM fact_cost_month
    WHERE period_key = ANY($1)
    GROUP BY period_key
  `, [allPeriods]);
  const costsByPeriod = new Map(costsRows.map((r: any) => [r.period_key, parseFloat(r.direct_usd)]));

  const { rows: hoursRows } = await pool.query(`
    SELECT period_key,
           COALESCE(SUM(asana_hours), 0) as total_hours,
           COALESCE(SUM(billing_hours), 0) as billable_hours
    FROM fact_labor_month
    WHERE period_key = ANY($1)
    GROUP BY period_key
  `, [allPeriods]);
  const hoursByPeriod = new Map(hoursRows.map((r: any) => [r.period_key, {
    total: parseFloat(r.total_hours),
    billable: parseFloat(r.billable_hours)
  }]));

  const devengadoArr: number[] = [];
  const ebitArr: number[] = [];
  const margenArr: number[] = [];
  const tarifaArr: number[] = [];
  const markupArr: number[] = [];
  const directosArr: number[] = [];

  for (const p of allPeriods) {
    const devengado = revByPeriod.get(p) || 0;
    const directos = costsByPeriod.get(p) || 0;
    const hours = hoursByPeriod.get(p) || { total: 0, billable: 0 };
    
    const ebit = devengado - directos;
    const margen = devengado > 0 ? (ebit / devengado) * 100 : 0;
    const tarifa = hours.billable > 0 ? devengado / hours.billable : 0;
    const markup = directos > 0 ? devengado / directos : 0;
    
    devengadoArr.push(devengado);
    ebitArr.push(ebit);
    margenArr.push(margen);
    tarifaArr.push(tarifa);
    markupArr.push(markup);
    directosArr.push(directos);
  }

  const currentIdx = allPeriods.length - 1;
  const currentData = {
    devengado: devengadoArr[currentIdx],
    ebit: ebitArr[currentIdx],
    tarifa: tarifaArr[currentIdx],
    markup: markupArr[currentIdx],
    margen: margenArr[currentIdx],
    directos: directosArr[currentIdx]
  };

  const prevDevengado = currentIdx > 0 ? devengadoArr[currentIdx - 1] : 0;
  const prevEbit = currentIdx > 0 ? ebitArr[currentIdx - 1] : 0;
  const prevTarifa = currentIdx > 0 ? tarifaArr[currentIdx - 1] : 0;
  const prevMarkup = currentIdx > 0 ? markupArr[currentIdx - 1] : 0;
  const prevDirectos = currentIdx > 0 ? directosArr[currentIdx - 1] : 0;

  const last3Devengado = devengadoArr.slice(Math.max(0, currentIdx - 3), currentIdx);
  const last3Ebit = ebitArr.slice(Math.max(0, currentIdx - 3), currentIdx);
  const last3Tarifa = tarifaArr.slice(Math.max(0, currentIdx - 3), currentIdx);
  const last3Markup = markupArr.slice(Math.max(0, currentIdx - 3), currentIdx);
  const last3Directos = directosArr.slice(Math.max(0, currentIdx - 3), currentIdx);

  const hours = hoursByPeriod.get(periodKey) || { total: 0, billable: 0 };
  const horasFacturablesPct = hours.total > 0 ? (hours.billable / hours.total) * 100 : 0;

  const alerts: Alert[] = [];

  const tarifaDiff3m = calcDiffVs3mAvg(currentData.tarifa, last3Tarifa);
  if (tarifaDiff3m !== null && tarifaDiff3m < -10) {
    alerts.push({
      type: 'warning',
      message: `Tarifa efectiva cayó ${Math.abs(tarifaDiff3m).toFixed(0)}% vs promedio 3m`,
      metric: 'tarifa_efectiva'
    });
  }

  if (currentData.markup < 2.5 && currentData.markup > 0) {
    alerts.push({
      type: 'warning',
      message: `Markup operativo bajo: ${currentData.markup.toFixed(1)}x (objetivo: >2.5x)`,
      metric: 'markup_operativo'
    });
  }

  if (horasFacturablesPct < 80 && hours.total > 0) {
    alerts.push({
      type: 'warning',
      message: `% facturable: ${horasFacturablesPct.toFixed(0)}% (objetivo: >80%)`,
      metric: 'pct_facturable'
    });
  }

  const horasNoFacturables = hours.total - hours.billable;
  const pctNoFacturable = hours.total > 0 ? (horasNoFacturables / hours.total) * 100 : 0;
  if (pctNoFacturable > 20) {
    alerts.push({
      type: 'info',
      message: `${pctNoFacturable.toFixed(0)}% de horas no facturables`,
      metric: 'horas_no_productivas'
    });
  }

  // FIX: Alert for negative EBIT operativo
  if (currentData.ebit < 0 && currentData.devengado > 0) {
    alerts.push({
      type: 'critical',
      message: `EBIT operativo negativo: -$${Math.abs(currentData.ebit / 1000).toFixed(1)}k`,
      metric: 'ebit_operativo'
    });
  }

  // FIX: Alert for revenue drop >15%
  const devengadoDiff = calcDiff(currentData.devengado, prevDevengado);
  if (devengadoDiff !== null && devengadoDiff < -15) {
    alerts.push({
      type: devengadoDiff < -30 ? 'critical' : 'warning',
      message: `Devengado cayó ${Math.abs(devengadoDiff).toFixed(0)}% vs mes anterior`,
      metric: 'devengado_drop'
    });
  }

  const billableArr: number[] = [];
  const nonBillableArr: number[] = [];
  for (const p of allPeriods) {
    const h = hoursByPeriod.get(p) || { total: 0, billable: 0 };
    billableArr.push(h.billable);
    nonBillableArr.push(h.total - h.billable);
  }

  const { rows: personasRows } = await pool.query(`
    SELECT person_key as person_name, COALESCE(SUM(billing_hours), 0) as hours
    FROM fact_labor_month
    WHERE period_key = $1
    GROUP BY person_key
    ORDER BY hours DESC
    LIMIT 8
  `, [periodKey]);
  const totalPersonas = personasRows.reduce((s: number, r: any) => s + parseFloat(r.hours), 0);
  const horasPorPersona: BreakdownItem[] = personasRows.map((r: any) => ({
    label: r.person_name,
    value: parseFloat(r.hours),
    pct: totalPersonas > 0 ? (parseFloat(r.hours) / totalPersonas) * 100 : 0
  }));

  const { rows: proyectosRows } = await pool.query(`
    SELECT project_key as project_name, COALESCE(SUM(billing_hours), 0) as hours
    FROM fact_labor_month
    WHERE period_key = $1
    GROUP BY project_key
    ORDER BY hours DESC
    LIMIT 8
  `, [periodKey]);
  const totalProyectos = proyectosRows.reduce((s: number, r: any) => s + parseFloat(r.hours), 0);
  const horasPorProyecto: BreakdownItem[] = proyectosRows.map((r: any) => ({
    label: r.project_name || 'Sin proyecto',
    value: parseFloat(r.hours),
    pct: totalProyectos > 0 ? (parseFloat(r.hours) / totalProyectos) * 100 : 0
  }));

  return {
    trends: {
      devengado: { months: allPeriods, values: devengadoArr },
      ebitOperativo: { months: allPeriods, values: ebitArr },
      margenOperativo: { months: allPeriods, values: margenArr },
      tarifaEfectiva: { months: allPeriods, values: tarifaArr },
      horas: { months: allPeriods, series: { billable: billableArr, nonBillable: nonBillableArr } }
    },
    diffs: {
      devengado: { 
        vsPrevMonth: calcDiff(currentData.devengado, prevDevengado),
        vs3mAvg: calcDiffVs3mAvg(currentData.devengado, last3Devengado)
      },
      ebitOperativo: {
        vsPrevMonth: calcDiff(currentData.ebit, prevEbit),
        vs3mAvg: calcDiffVs3mAvg(currentData.ebit, last3Ebit)
      },
      tarifaEfectiva: {
        vsPrevMonth: calcDiff(currentData.tarifa, prevTarifa),
        vs3mAvg: calcDiffVs3mAvg(currentData.tarifa, last3Tarifa)
      },
      markup: {
        vsPrevMonth: calcDiff(currentData.markup, prevMarkup),
        vs3mAvg: calcDiffVs3mAvg(currentData.markup, last3Markup)
      },
      directos: {
        vsPrevMonth: calcDiff(currentData.directos, prevDirectos),
        vs3mAvg: calcDiffVs3mAvg(currentData.directos, last3Directos)
      }
    },
    alerts,
    breakdowns: {
      horasDistribucion: [
        { label: 'Facturables', value: hours.billable, pct: horasFacturablesPct },
        { label: 'No facturables', value: horasNoFacturables, pct: 100 - horasFacturablesPct }
      ],
      horasPorPersona,
      horasPorProyecto
    }
  };
}

export async function getEconomicoTrendsAndDiffs(periodKey: string): Promise<{
  trends: {
    devengado: TrendData;
    ebitEconomico: TrendData;
    margenEconomico: TrendData;
    costMix: MultiSeriesTrend;
  };
  diffs: {
    devengado: DiffData;
    ebitEconomico: DiffData;
    overhead: DiffData;
  };
  alerts: Alert[];
  breakdowns: {
    costosDistribucion: BreakdownItem[];
  };
}> {
  const prev12 = getPreviousPeriods(periodKey, 11);
  const allPeriods = [...prev12.reverse(), periodKey];

  // FIX: Usar fact_rc_month para devengado (consistente con KPI cards)
  const { rows: revenueRows } = await pool.query(`
    SELECT period_key, COALESCE(SUM(revenue_usd), 0) as devengado_usd
    FROM fact_rc_month
    WHERE period_key = ANY($1)
    GROUP BY period_key
  `, [allPeriods]);
  const revByPeriod = new Map(revenueRows.map((r: any) => [r.period_key, parseFloat(r.devengado_usd)]));

  const { rows: costsRows } = await pool.query(`
    SELECT period_key,
           COALESCE(SUM(direct_usd), 0) as direct_usd,
           COALESCE(SUM(indirect_usd), 0) as indirect_usd
    FROM fact_cost_month
    WHERE period_key = ANY($1)
    GROUP BY period_key
  `, [allPeriods]);
  const costsByPeriod = new Map(costsRows.map((r: any) => [r.period_key, {
    direct: parseFloat(r.direct_usd),
    indirect: parseFloat(r.indirect_usd)
  }]));

  const devengadoArr: number[] = [];
  const ebitArr: number[] = [];
  const margenArr: number[] = [];
  const overheadArr: number[] = [];

  for (const p of allPeriods) {
    const devengado = revByPeriod.get(p) || 0;
    const costs = costsByPeriod.get(p) || { direct: 0, indirect: 0 };
    
    const ebit = devengado - costs.direct - costs.indirect;
    const margen = devengado > 0 ? (ebit / devengado) * 100 : 0;
    
    devengadoArr.push(devengado);
    ebitArr.push(ebit);
    margenArr.push(margen);
    overheadArr.push(costs.indirect);
  }

  const currentIdx = allPeriods.length - 1;
  const costs = costsByPeriod.get(periodKey) || { direct: 0, indirect: 0 };
  const currentData = {
    devengado: devengadoArr[currentIdx],
    ebit: ebitArr[currentIdx],
    overhead: costs.indirect,
    directos: costs.direct
  };

  const prevDevengado = currentIdx > 0 ? devengadoArr[currentIdx - 1] : 0;
  const prevEbit = currentIdx > 0 ? ebitArr[currentIdx - 1] : 0;
  const prevOverhead = currentIdx > 0 ? overheadArr[currentIdx - 1] : 0;

  const last3Devengado = devengadoArr.slice(Math.max(0, currentIdx - 3), currentIdx);
  const last3Ebit = ebitArr.slice(Math.max(0, currentIdx - 3), currentIdx);
  const last3Overhead = overheadArr.slice(Math.max(0, currentIdx - 3), currentIdx);

  const alerts: Alert[] = [];

  if (currentData.ebit < 0) {
    alerts.push({
      type: 'critical',
      message: 'Margen económico negativo este período',
      metric: 'margen_economico'
    });
  }

  const totalCosts = currentData.directos + currentData.overhead;
  const overheadRatio = totalCosts > 0 ? currentData.overhead / totalCosts : 0;
  if (overheadRatio > 0.45) {
    alerts.push({
      type: 'warning',
      message: `Overhead representa ${(overheadRatio * 100).toFixed(0)}% del costo total (objetivo: <45%)`,
      metric: 'overhead_ratio'
    });
  }

  const overheadDiff = calcDiff(currentData.overhead, prevOverhead);
  if (overheadDiff !== null && overheadDiff > 20) {
    alerts.push({
      type: 'warning',
      message: `Overhead creció ${overheadDiff.toFixed(0)}% vs mes anterior`,
      metric: 'overhead_growth'
    });
  }

  const directosArr: number[] = [];
  for (const p of allPeriods) {
    const c = costsByPeriod.get(p) || { direct: 0, indirect: 0 };
    directosArr.push(c.direct);
  }

  return {
    trends: {
      devengado: { months: allPeriods, values: devengadoArr },
      ebitEconomico: { months: allPeriods, values: ebitArr },
      margenEconomico: { months: allPeriods, values: margenArr },
      costMix: { months: allPeriods, series: { directos: directosArr, overhead: overheadArr } }
    },
    diffs: {
      devengado: {
        vsPrevMonth: calcDiff(currentData.devengado, prevDevengado),
        vs3mAvg: calcDiffVs3mAvg(currentData.devengado, last3Devengado)
      },
      ebitEconomico: {
        vsPrevMonth: calcDiff(currentData.ebit, prevEbit),
        vs3mAvg: calcDiffVs3mAvg(currentData.ebit, last3Ebit)
      },
      overhead: {
        vsPrevMonth: calcDiff(currentData.overhead, prevOverhead),
        vs3mAvg: calcDiffVs3mAvg(currentData.overhead, last3Overhead)
      }
    },
    alerts,
    breakdowns: {
      costosDistribucion: [
        { label: 'Directos', value: currentData.directos, pct: totalCosts > 0 ? (currentData.directos / totalCosts) * 100 : 0 },
        { label: 'Overhead', value: currentData.overhead, pct: totalCosts > 0 ? (currentData.overhead / totalCosts) * 100 : 0 }
      ]
    }
  };
}

export async function getFinanzasTrendsAndDiffs(periodKey: string): Promise<{
  trends: {
    facturado: TrendData;
    ebitContable: TrendData;
    cashFlowNeto: TrendData;
    cashflow: MultiSeriesTrend;
  };
  diffs: {
    facturado: DiffData;
    ebitContable: DiffData;
    cashFlowNeto: DiffData;
    burnRate: DiffData;
  };
  alerts: Alert[];
  breakdowns: {
    estructuraFinanciera: BreakdownItem[];
    cashflowDistribucion: BreakdownItem[];
  };
}> {
  const prev12 = getPreviousPeriods(periodKey, 11);
  const allPeriods = [...prev12.reverse(), periodKey];

  // FIX: Include total_activo, total_pasivo from monthly_financial_summary
  // Before: only fetched facturacion_total and caja_total, then used caja=activo, overhead=pasivo (WRONG)
  const { rows: financialRows } = await pool.query(`
    SELECT period_key, facturacion_total, caja_total, total_activo, total_pasivo
    FROM monthly_financial_summary
    WHERE period_key = ANY($1)
  `, [allPeriods]);
  const financialByPeriod = new Map(financialRows.map((r: any) => [r.period_key, {
    facturado: parseFloat(r.facturacion_total || '0'),
    cajaTotal: r.caja_total != null ? parseFloat(r.caja_total) : null,
    activoTotal: parseFloat(r.total_activo || '0'),
    pasivoTotal: parseFloat(r.total_pasivo || '0'),
  }]));

  // FIX: Use fact_cost_month for provisions (consistent with KPI cards)
  // Before: used pl_adjustments which is a different data source
  const { rows: costsRows } = await pool.query(`
    SELECT period_key,
           COALESCE(SUM(direct_usd), 0) as direct_usd,
           COALESCE(SUM(indirect_usd), 0) as indirect_usd,
           COALESCE(SUM(provisions_usd), 0) as provisions_usd
    FROM fact_cost_month
    WHERE period_key = ANY($1)
    GROUP BY period_key
  `, [allPeriods]);
  const costsByPeriod = new Map(costsRows.map((r: any) => [r.period_key, {
    direct: parseFloat(r.direct_usd),
    indirect: parseFloat(r.indirect_usd),
    provisions: parseFloat(r.provisions_usd),
  }]));

  const { rows: cashRows } = await pool.query(`
    SELECT period_key,
           COALESCE(SUM(CASE WHEN type = 'IN' THEN amount_usd::numeric ELSE 0 END), 0) as cash_in,
           COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount_usd::numeric ELSE 0 END), 0) as cash_out
    FROM cash_movements
    WHERE period_key = ANY($1)
    GROUP BY period_key
  `, [allPeriods]);
  const cashByPeriod = new Map(cashRows.map((r: any) => [r.period_key, {
    cashIn: parseFloat(r.cash_in),
    cashOut: parseFloat(r.cash_out)
  }]));

  const facturadoArr: number[] = [];
  const ebitArr: number[] = [];
  const cashFlowArr: number[] = [];
  const burnRateArr: number[] = [];

  for (const p of allPeriods) {
    const fin = financialByPeriod.get(p) || { facturado: 0, cajaTotal: null, activoTotal: 0, pasivoTotal: 0 };
    const costs = costsByPeriod.get(p) || { direct: 0, indirect: 0, provisions: 0 };
    const cash = cashByPeriod.get(p) || { cashIn: 0, cashOut: 0 };

    const totalCosts = costs.direct + costs.indirect + costs.provisions;
    const ebit = fin.facturado - totalCosts;
    const cashFlow = cash.cashIn - cash.cashOut;

    facturadoArr.push(fin.facturado);
    ebitArr.push(ebit);
    cashFlowArr.push(cashFlow);
    burnRateArr.push(totalCosts);
  }

  const currentIdx = allPeriods.length - 1;
  const fin = financialByPeriod.get(periodKey) || { facturado: 0, cajaTotal: null, activoTotal: 0, pasivoTotal: 0 };
  const costs = costsByPeriod.get(periodKey) || { direct: 0, indirect: 0, provisions: 0 };

  // FIX: cajaTotal null means data missing, not zero (overdraft is valid negative)
  const cajaTotal = fin.cajaTotal ?? 0;

  const currentData = {
    facturado: facturadoArr[currentIdx],
    ebit: ebitArr[currentIdx],
    cashFlow: cashFlowArr[currentIdx],
    burnRate: burnRateArr[currentIdx],
    cajaTotal,
  };
  const runwayMeses = currentData.burnRate > 0 && fin.cajaTotal != null
    ? currentData.cajaTotal / currentData.burnRate
    : 0;

  const prevFacturado = currentIdx > 0 ? facturadoArr[currentIdx - 1] : 0;
  const prevEbit = currentIdx > 0 ? ebitArr[currentIdx - 1] : 0;
  const prevCashFlow = currentIdx > 0 ? cashFlowArr[currentIdx - 1] : 0;
  const prevBurnRate = currentIdx > 0 ? burnRateArr[currentIdx - 1] : 0;

  const last3Facturado = facturadoArr.slice(Math.max(0, currentIdx - 3), currentIdx);
  const last3Ebit = ebitArr.slice(Math.max(0, currentIdx - 3), currentIdx);
  const last3CashFlow = cashFlowArr.slice(Math.max(0, currentIdx - 3), currentIdx);
  const last3BurnRate = burnRateArr.slice(Math.max(0, currentIdx - 3), currentIdx);

  const alerts: Alert[] = [];

  if (runwayMeses < 3 && runwayMeses > 0) {
    alerts.push({
      type: 'critical',
      message: `Runway crítico: ${runwayMeses.toFixed(1)} meses`,
      metric: 'runway_meses'
    });
  } else if (runwayMeses >= 3 && runwayMeses < 6) {
    alerts.push({
      type: 'warning',
      message: `Runway bajo: ${runwayMeses.toFixed(1)} meses (objetivo: >6)`,
      metric: 'runway_meses'
    });
  }

  if (currentData.cashFlow < 0 && prevCashFlow < 0) {
    alerts.push({
      type: 'critical',
      message: 'Cash flow negativo dos meses consecutivos',
      metric: 'cash_flow_consecutivo'
    });
  } else if (currentData.cashFlow < 0) {
    alerts.push({
      type: 'warning',
      message: `Cash flow negativo: $${Math.abs(currentData.cashFlow / 1000).toFixed(1)}k`,
      metric: 'cash_flow_neto'
    });
  }

  if (currentData.facturado > 0 && costs.provisions / currentData.facturado > 0.4) {
    alerts.push({
      type: 'warning',
      message: `Provisiones altas: ${((costs.provisions / currentData.facturado) * 100).toFixed(0)}% del facturado`,
      metric: 'provisiones_ratio'
    });
  }

  // FIX: EBIT contable negativo alert
  if (currentData.ebit < 0) {
    alerts.push({
      type: 'critical',
      message: `EBIT contable negativo: -$${Math.abs(currentData.ebit / 1000).toFixed(1)}k`,
      metric: 'ebit_contable'
    });
  }

  // FIX: Revenue drop alert (>15%)
  const facturadoDiff = calcDiff(currentData.facturado, prevFacturado);
  if (facturadoDiff !== null && facturadoDiff < -15) {
    alerts.push({
      type: facturadoDiff < -30 ? 'critical' : 'warning',
      message: `Facturado cayó ${Math.abs(facturadoDiff).toFixed(0)}% vs mes anterior`,
      metric: 'facturado_drop'
    });
  }

  // FIX: Use monthly_financial_summary.total_activo/total_pasivo (NOT caja/overhead)
  const activoTotal = fin.activoTotal;
  const pasivoTotal = fin.pasivoTotal;
  const patrimonio = activoTotal - pasivoTotal;

  if (pasivoTotal > activoTotal && activoTotal > 0) {
    alerts.push({
      type: 'warning',
      message: `Pasivo ($${(pasivoTotal/1000).toFixed(0)}k) supera activo ($${(activoTotal/1000).toFixed(0)}k)`,
      metric: 'patrimonio'
    });
  }

  // FIX: Warn if caja_total is null (data missing from Excel)
  if (fin.cajaTotal == null) {
    alerts.push({
      type: 'info',
      message: 'Dato de caja total no disponible para este período',
      metric: 'caja_total_missing'
    });
  }

  const cashInArr: number[] = [];
  const cashOutArr: number[] = [];
  for (const p of allPeriods) {
    const c = cashByPeriod.get(p) || { cashIn: 0, cashOut: 0 };
    cashInArr.push(c.cashIn);
    cashOutArr.push(c.cashOut);
  }

  const cash = cashByPeriod.get(periodKey) || { cashIn: 0, cashOut: 0 };
  const cashTotal = cash.cashIn + cash.cashOut;

  // FIX: Estructura financiera uses correct Activo/Pasivo/Patrimonio
  const totalBalance = activoTotal > 0 ? activoTotal : Math.abs(patrimonio) + pasivoTotal;

  return {
    trends: {
      facturado: { months: allPeriods, values: facturadoArr },
      ebitContable: { months: allPeriods, values: ebitArr },
      cashFlowNeto: { months: allPeriods, values: cashFlowArr },
      cashflow: { months: allPeriods, series: { cashIn: cashInArr, cashOut: cashOutArr } }
    },
    diffs: {
      facturado: {
        vsPrevMonth: calcDiff(currentData.facturado, prevFacturado),
        vs3mAvg: calcDiffVs3mAvg(currentData.facturado, last3Facturado)
      },
      ebitContable: {
        vsPrevMonth: calcDiff(currentData.ebit, prevEbit),
        vs3mAvg: calcDiffVs3mAvg(currentData.ebit, last3Ebit)
      },
      cashFlowNeto: {
        vsPrevMonth: calcDiff(currentData.cashFlow, prevCashFlow),
        vs3mAvg: calcDiffVs3mAvg(currentData.cashFlow, last3CashFlow)
      },
      burnRate: {
        vsPrevMonth: calcDiff(currentData.burnRate, prevBurnRate),
        vs3mAvg: calcDiffVs3mAvg(currentData.burnRate, last3BurnRate)
      }
    },
    alerts,
    breakdowns: {
      estructuraFinanciera: [
        { label: 'Activo', value: activoTotal, pct: totalBalance > 0 ? (activoTotal / totalBalance) * 100 : 0 },
        { label: 'Pasivo', value: pasivoTotal, pct: totalBalance > 0 ? (pasivoTotal / totalBalance) * 100 : 0 },
        { label: 'Patrimonio', value: patrimonio, pct: totalBalance > 0 ? (patrimonio / totalBalance) * 100 : 0 }
      ],
      cashflowDistribucion: [
        { label: 'Ingresos', value: cash.cashIn, pct: cashTotal > 0 ? (cash.cashIn / cashTotal) * 100 : 0 },
        { label: 'Egresos', value: cash.cashOut, pct: cashTotal > 0 ? (cash.cashOut / cashTotal) * 100 : 0 }
      ]
    }
  };
}
