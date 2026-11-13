import type { MonthlyReconciliationReport, MonthlyProjectRow, ProjectFollowupRow } from '../../shared/monthly-reconciliation';
import { buildMasterScenario, type MasterScenarioSnapshot } from '../services/financial-master-scenario';

export const normalized = (value: unknown) => String(value ?? '').normalize('NFKD').replace(/\p{Diacritic}/gu, '')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const text = (value: unknown) => String(value ?? '').trim();
const periodOf = (month: unknown, year: unknown) => {
  const m = Number(String(month ?? '').match(/^\s*(\d{1,2})\b/)?.[1]);
  return Number.isInteger(Number(year)) && m >= 1 && m <= 12 ? `${year}-${String(m).padStart(2, '0')}` : null;
};

/** Documented aliases only. A parent contract rollup never renames its followup snapshots. */
export function monthlyProjectIdentity(client: unknown, project: unknown) {
  let c = normalized(client), p = normalized(project);
  if (c === 'em marketing communication') c = 'em';
  if (c === 'animal studio' && ['animal tracking workshop', 'novo tracking workshop', 'novo seguimiento workshop'].includes(p)) p = 'tracking workshop';
  if (c === 'bid' && ['bid cambio climatico', 'cambio climatico', 'exploratorio cambio climatico'].includes(p)) p = 'cambio climatico';
  if (c === 'trendsity' && ['tendecias alimentacion mx', 'estudio tendencias alimentacion mx'].includes(p)) p = 'alimentacion mx';
  if (c === 'uber' && ['uber mobility linea u', 'mobility linea u'].includes(p)) p = 'mobility linea u';
  if (c === 'uber' && ['uber eats mcdonald s', 'eats mcdonald s', 'uber eats mcdonalds'].includes(p)) p = 'eats mcdonalds';
  if (c === 'warner' && (p === 'fee insights' || p.startsWith('fee insights '))) p = 'fee insights';
  return { key: `${c}::${p}`, clientName: c === 'em' ? 'EM' : text(client) || 'Sin asignación', projectName: text(project) || 'Sin asignación' };
}

export function buildMasterMonthlyReconciliation(data: MasterScenarioSnapshot, period: string): MonthlyReconciliationReport {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Período inválido');
  if (!data.sales?.length || !data.performance?.length) throw new Error('Faltan ventas o seguimiento del Máster');
  for (const [index, expected] of [[0, 'Mes Facturación'], [1, 'Año Facturación'], [4, 'Cliente'], [5, 'Proyecto'], [17, 'Monto Total USD']] as const) {
    if (normalized(data.sales[0][index]) !== normalized(expected)) throw new Error(`Cambió la columna de ventas: ${expected}`);
  }
  for (const [index, expected] of [[0, 'Cliente'], [2, 'Proyecto'], [3, 'Mes'], [6, 'Facturación [USD]'], [9, 'Estado de proyecto']] as const) {
    if (normalized(data.performance[0][index]) !== normalized(expected)) throw new Error(`Cambió la columna de seguimiento: ${expected}`);
  }
  const scenario = buildMasterScenario(data, [period]);
  const summary = scenario.months[0];
  const placeholders: string[] = [];
  const costs = scenario.costs.filter(cost => {
    if (cost.impact === 'net') return false;
    const raw = data.actual[Number(cost.id.split(':').at(-1)) - 1];
    const empty = (value: unknown) => value == null || value === '';
    // A zero-rate, hourless preparation row with no original money is not an expense.
    // Broken conversions or unknown planned expenses remain unavailable, not zero.
    if (cost.source === 'master' && cost.amountUsd == null && raw?.[14] === 0
      && [11,12,13,15,16,17,18].every(index => empty(raw[index]))) {
      placeholders.push(cost.sourceDetail ?? cost.id); return false;
    }
    return true;
  });
  const hasActual = costs.some(cost => cost.source === 'master');
  const hasEstimate = costs.some(cost => cost.source === 'estimate');
  // A genuine zero expense month needs the complete source and an explicit zero in the summary.
  const costBasis = hasActual ? 'actual' : hasEstimate ? 'estimated'
    : summary.costUsd === 0 && !scenario.warnings.length ? 'actual' : 'unavailable';
  const warnings = [...scenario.warnings];
  if (placeholders.length) warnings.push(`${placeholders.length} fila(s) de preparación sin horas ni importes no representan gastos: ${placeholders.join('; ')}`);
  const missingCosts = costs.filter(cost => cost.amountUsd == null);
  if (missingCosts.length) warnings.push(`Falta el importe de ${missingCosts.length} costo(s): ${missingCosts.map(cost => cost.sourceDetail).join('; ')}`);
  const grouped = new Map<string, MonthlyProjectRow>();
  const get = (client: unknown, project: unknown, type?: unknown) => {
    const identity = monthlyProjectIdentity(client, project);
    if (!grouped.has(identity.key)) grouped.set(identity.key, { ...identity, projectType: text(type) || null,
      revenueUsd: 0, directCostUsd: costBasis === 'actual' ? 0 : null, sourceRefs: [] });
    return grouped.get(identity.key)!;
  };
  let salesMissing = false;
  data.sales.slice(1).forEach((row, index) => {
    if (periodOf(row[0], row[1]) !== period) return;
    const amount = number(row[17]);
    if (amount == null) { salesMissing = true; warnings.push(`Venta sin importe válido: fila ${index + 2}`); return; }
    const result = get(row[4], row[5], row[6]);
    result.revenueUsd += amount;
    result.sourceRefs.push(`Proyectos confirmados y estimados!R${index + 2}`);
  });
  if (costBasis === 'actual') {
    const included = new Set(costs.map(cost => cost.id));
    data.actual.slice(1).forEach((row, index) => {
      if (!included.has(`master:actual:${index + 2}`) || normalized(row[5]) !== 'directo') return;
      let client = row[10], project = row[9];
      // The source instructive explicitly assigns this supplier to this monthly account.
      if (!text(client) && !text(project) && normalized(row[0]) === 'pablo ovejero') { client = 'Detroit'; project = 'Fee mensual'; }
      const amount = number(row[18]);
      if (amount == null) { warnings.push(`Costo sin importe válido: fila ${index + 2}`); return; }
      const result = get(client, project, row[8]);
      result.directCostUsd! += amount;
      result.sourceRefs.push(`Costos directos e indirectos!S${index + 2}`);
      if (!text(client) || !text(project)) warnings.push(`Costo directo sin asignación a proyecto: fila ${index + 2}`);
    });
  }
  const followup: ProjectFollowupRow[] = [];
  const seen = new Set<string>();
  data.performance.slice(1).forEach((row, index) => {
    if (!text(row[0]) || !text(row[2]) || periodOf(row[3], row[4]) !== period) return;
    const key = `${normalized(row[0])}::${normalized(row[2])}`;
    if (seen.has(key)) { warnings.push(`Seguimiento duplicado para ${text(row[0])}: ${text(row[2])}`); return; }
    seen.add(key);
    const state = normalized(row[9]);
    followup.push({ key, clientName: text(row[0]), projectName: text(row[2]), projectType: text(row[1]) || null,
      budgetUsd: number(row[6]), cumulativeCostUsd: number(row[7]),
      status: state.startsWith('cerrado') ? 'closed' : state.startsWith('abierto') ? 'open' : 'unknown',
      sourceRef: `Rendimiento Cliente!A${index + 2}:J${index + 2}` });
  });
  const covered = new Set(followup.map(row => monthlyProjectIdentity(row.clientName, row.projectName).key));
  const missingFollowup = [...grouped.values()].filter(row => row.revenueUsd !== 0 && !covered.has(row.key))
    .map(row => ({ clientName: row.clientName, projectName: row.projectName, revenueUsd: roundMoney(row.revenueUsd) }));
  const rows = [...grouped.values()].sort((a, b) => b.revenueUsd - a.revenueUsd);
  const rawSales = rows.reduce((sum, row) => sum + row.revenueUsd, 0);
  const salesUsd = roundMoney(rawSales);
  const directCostUsd = costBasis === 'actual' ? roundMoney(rows.reduce((sum, row) => sum + (row.directCostUsd ?? 0), 0)) : null;
  const rawOperating = costBasis !== 'unavailable' && costs.every(cost => cost.amountUsd != null)
    ? costs.reduce((sum, cost) => sum + cost.amountUsd!, 0) : costBasis === 'actual' && summary.costUsd === 0 ? 0 : null;
  const operatingCostUsd = rawOperating == null ? null : roundMoney(rawOperating);
  const salesDifferenceUsd = salesMissing ? null : roundMoney(salesUsd - summary.revenueUsd);
  const costsDifferenceUsd = operatingCostUsd == null ? null : roundMoney(operatingCostUsd - summary.costUsd);
  const closed = followup.filter(row => row.status === 'closed');
  const closedCost = closed.reduce((sum, row) => sum + (row.cumulativeCostUsd ?? 0), 0);
  const closedProjectMarkup = closed.length && closed.every(row => row.budgetUsd != null && row.cumulativeCostUsd != null) && closedCost > 0
    ? closed.reduce((sum, row) => sum + row.budgetUsd!, 0) / closedCost : null;
  const summaryClosedProjectMarkup = number(data.summary.slice(1).find(row => periodOf(row[0],row[1]) === period)?.[18]);
  if (closedProjectMarkup != null && summaryClosedProjectMarkup != null && Math.abs(closedProjectMarkup-summaryClosedProjectMarkup)>0.0001) warnings.push('El markup de proyectos cerrados no coincide con el del resumen; revisar estados o costos acumulados.');
  return { periodKey: period, source: 'master', readAt: data.readAt, costBasis, rows, followup, missingFollowup,
    totals: { salesUsd, directCostUsd, operatingCostUsd, overheadUsd: operatingCostUsd != null && directCostUsd != null ? roundMoney(operatingCostUsd - directCostUsd) : null,
      ebitUsd: rawOperating == null || salesMissing ? null : roundMoney(rawSales - rawOperating),
      summarySalesUsd: roundMoney(summary.revenueUsd), summaryOperatingCostUsd: roundMoney(summary.costUsd), salesDifferenceUsd, costsDifferenceUsd,
      closedProjectMarkup, summaryClosedProjectMarkup },
    status: salesDifferenceUsd == null || costsDifferenceUsd == null ? 'unavailable'
      : Math.abs(salesDifferenceUsd) <= 0.02 && Math.abs(costsDifferenceUsd) <= 0.02 ? 'matched' : 'difference', warnings };
}
