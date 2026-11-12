import { createSheetsClient } from './direct-sheets-dashboard';
import { ReadCache } from '../utils/read-cache';
import { normalizeScenarioText, type ScenarioCost, type ScenarioMonth } from '../../shared/financial-scenario';

const spreadsheetId = '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc';
type Cell = string | number | boolean | null;
type Rows = Cell[][];
export interface MasterScenarioSnapshot {
  summary: Rows;
  actual: Rows;
  estimates: Rows;
  liabilities: Rows;
  readAt: string;
}
const cache = new ReadCache<MasterScenarioSnapshot>(30_000, 1);

/** One read-only batch: totals and their underlying rows must belong to the same read. */
export function getMasterScenarioSnapshot(): Promise<MasterScenarioSnapshot> {
  return cache.get('master', async () => {
    const response = await createSheetsClient().spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: ["'Resumen Ejecutivo'!A:V", "'Costos directos e indirectos'!A:S", "'Costos estimados'!A:N", "'Pasivo'!A:N"],
      valueRenderOption: 'UNFORMATTED_VALUE',
    }, { timeout: 20_000 });
    const [summary, actual, estimates, liabilities] = response.data.valueRanges?.map(range => range.values ?? []) ?? [];
    if (!summary?.length || !actual?.length || !estimates?.length || !liabilities?.length) {
      throw new Error('El Máster no devolvió todas las fuentes del escenario');
    }
    const snapshot = { summary, actual, estimates, liabilities, readAt: new Date().toISOString() };
    validateMasterHeaders(snapshot);
    return snapshot;
  });
}

function validateMasterHeaders(data: MasterScenarioSnapshot) {
  const checks: [Rows, number, string][] = [
    [data.summary, 0, 'Mes'], [data.summary, 1, 'Año'], [data.summary, 13, 'Ventas del mes'],
    [data.summary, 14, 'EBIT Utilidad operativa'], [data.summary, 15, 'Beneficio Neto'],
    [data.actual, 0, 'Detalle'], [data.actual, 2, 'Mes'], [data.actual, 4, 'Año'],
    [data.actual, 18, 'Monto Total USD'], [data.estimates, 0, 'Mes'], [data.estimates, 1, 'Año'],
    [data.estimates, 3, 'Detalle'], [data.estimates, 12, 'Monto Total USD'],
    [data.liabilities, 0, 'Detalle'], [data.liabilities, 2, 'Mes'], [data.liabilities, 3, 'Año'],
    [data.liabilities, 13, 'Monto Total USD'],
  ];
  for (const [rows, index, expected] of checks) {
    if (normalizeScenarioText(String(rows[0]?.[index] ?? '')) !== normalizeScenarioText(expected)) {
      throw new Error(`Cambió la estructura del Máster: columna ${expected}`);
    }
  }
}
const amount = (cell: Cell | undefined) => typeof cell === 'number' && Number.isFinite(cell) ? cell : null;
function period(month: Cell, year: Cell): string | null {
  const m = Number(String(month ?? '').match(/^\s*(\d{1,2})\b/)?.[1]);
  const y = Number(year);
  return Number.isInteger(y) && y >= 2020 && m >= 1 && m <= 12 ? `${y}-${String(m).padStart(2, '0')}` : null;
}
const text = (cell: Cell | undefined) => String(cell ?? '').trim();
const excludedFromEbit = new Set(['iva', 'iibb', 'impuestos usa', 'intereses oxean']);
const total = (costs: ScenarioCost[]) => costs.reduce((sum, cost) => sum + (cost.amountUsd ?? 0), 0);
const agrees = (left: number, right: number) => Math.abs(left - right) <= 0.02;

/** Match the actual formulas of Resumen Ejecutivo, not the different operating ETL rules. */
export function buildMasterScenario(data: MasterScenarioSnapshot, requestedPeriods: string[]) {
  validateMasterHeaders(data);
  const wanted = new Set(requestedPeriods);
  const allActual: ScenarioCost[] = [];
  const allEstimates: ScenarioCost[] = [];
  const provisions: ScenarioCost[] = [];
  for (const [source, rows] of [['master', data.actual], ['estimate', data.estimates]] as const) {
    rows.slice(1).forEach((row, index) => {
      const isActual = source === 'master';
      const key = isActual ? period(row[2], row[4]) : period(row[0], row[1]);
      const concept = text(row[isActual ? 0 : 3]);
      if (!key || !wanted.has(key) || !concept) return;
      const normalized = normalizeScenarioText(concept);
      // IVA is already excluded from both formulas. Excluding it again has no impact.
      if (normalized === 'iva' || (!isActual && excludedFromEbit.has(normalized))) return;
      const impact = excludedFromEbit.has(normalized) ? 'net' : !isActual || /-bono/i.test(concept) ? 'ebit' : 'operating';
      const sourceDetail = isActual ? 'Costos directos e indirectos' : 'Costos estimados';
      const cost: ScenarioCost = {
        id: `master:${isActual ? 'actual' : 'estimate'}:${index + 2}`, periodKey: key,
        concept, category: text(row[isActual ? 1 : 4]),
        description: isActual ? [row[7], row[9], row[10], ['si', 'sí'].includes(text(row[6]).toLowerCase()) ? 'Marketing' : '']
          .map(text).filter(Boolean).join(' · ') : text(row[5]),
        date: null, source, sourceDetail: `${sourceDetail} · fila ${index + 2}`,
        // Keep source precision until the monthly aggregate, exactly as SUMIFS does.
        amountUsd: amount(row[isActual ? 18 : 12]), impact,
      };
      (isActual ? allActual : allEstimates).push(cost);
    });
  }
  data.liabilities.slice(1).forEach((row, index) => {
    const key = period(row[2], row[3]);
    if (!key || !wanted.has(key) || normalizeScenarioText(text(row[0])) !== 'provision pasivo') return;
    provisions.push({ id: `master:provision:${index + 2}`, periodKey: key, concept: text(row[0]),
      category: text(row[1]), description: [row[7], row[8]].map(text).filter(Boolean).join(' · '),
      date: null, source: 'master', sourceDetail: `Pasivo · fila ${index + 2}`, amountUsd: amount(row[13]), impact: 'net' });
  });
  const months: ScenarioMonth[] = [];
  const costs: ScenarioCost[] = [];
  const warnings: string[] = [];
  for (const key of requestedPeriods) {
    const rows = data.summary.slice(1).filter(row => period(row[0], row[1]) === key);
    if (rows.length !== 1) throw new Error(`Falta un resumen único del Máster para ${key}`);
    const row = rows[0];
    const revenue = amount(row[13]), ebit = amount(row[14]);
    if (revenue == null || ebit == null) throw new Error(`Falta facturación o EBIT del Máster para ${key}`);
    const baseCost = revenue - ebit;
    const actual = allActual.filter(cost => cost.periodKey === key);
    const estimated = allEstimates.filter(cost => cost.periodKey === key);
    const monthProvisions = provisions.filter(cost => cost.periodKey === key);
    const operating = actual.filter(cost => cost.impact !== 'net');
    const actualMatches = agrees(total(operating), baseCost);
    const estimateMatches = agrees(total(estimated), baseCost);
    // Choose one complete monthly basis. Never fill gaps in actuals with budget rows.
    const useActual = actualMatches && (actual.length > 0 || !estimated.length);
    let net = amount(row[15]);
    if (useActual) {
      costs.push(...actual, ...monthProvisions);
      const netCosts = [...actual.filter(cost => cost.impact !== 'ebit'), ...monthProvisions];
      if (net == null || !agrees(revenue - total(netCosts), net)) {
        net = null;
        warnings.push(`${text(row[0])}: el detalle no concilia con el beneficio neto; no se calcula un neto ajustado.`);
      }
    } else if (estimateMatches) {
      costs.push(...estimated);
      // The sheet's net formula always uses actuals, even when EBIT uses the budget.
      net = null;
    } else {
      net = null;
      warnings.push(`${text(row[0])}: los costos del detalle no coinciden con Ventas menos EBIT; las exclusiones de este mes están deshabilitadas.`);
    }
    months.push({ periodKey: key, monthLabel: text(row[0]), revenueUsd: revenue, costUsd: baseCost,
      ebitUsd: ebit, netProfitUsd: net });
  }
  return { months, costs, warnings };
}
