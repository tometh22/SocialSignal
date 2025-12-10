import { Pool } from '@neondatabase/serverless';
import { getDevengadoSimple } from './devengado.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface OperativoData {
  periodKey: string;
  label: string;
  devengadoUsd: number;
  devengadoVariation: number | null;
  directosUsd: number;
  directosVariation: number | null;
  overheadOperativoUsd: 0;
  ebitOperativoUsd: number;
  ebitVariation: number | null;
  margenOperativoPct: number;
  markupOperativo: number;
  tarifaEfectivaUsd: number;
  tarifaVariation: number | null;
  horasFacturablesPct: number;
  horasTrabajadas: number;
  personasActivas: number;
  proyectosActivos: number;
  formula: {
    ebit: string;
    margen: string;
    markup: string;
    tarifa: string;
  };
  source: {
    devengado: string;
    directos: string;
    horas: string;
  };
}

export interface EconomicoData {
  periodKey: string;
  label: string;
  devengadoUsd: number;
  devengadoVariation: number | null;
  directosUsd: number;
  directosVariation: number | null;
  overheadUsd: number;
  overheadVariation: number | null;
  overheadRatioPct: number;
  ebitEconomicoUsd: number;
  ebitVariation: number | null;
  margenEconomicoPct: number;
  personasActivas: number;
  proyectosActivos: number;
  formula: {
    ebit: string;
    margen: string;
  };
  source: {
    devengado: string;
    directos: string;
    overhead: string;
  };
}

export interface FinanzasData {
  periodKey: string;
  label: string;
  facturadoUsd: number;
  facturadoVariation: number | null;
  directosUsd: number;
  overheadUsd: number;
  provisionesUsd: number;
  totalContableUsd: number;
  ebitContableUsd: number;
  ebitVariation: number | null;
  margenContablePct: number;
  burnRateUsd: number;
  beneficioNetoUsd: number;
  cashInUsd: number;
  cashOutUsd: number;
  cashFlowNetoUsd: number;
  cashFlowVariation: number | null;
  cajaTotalUsd: number;
  runwayMeses: number;
  activoTotalUsd: number;
  pasivoTotalUsd: number;
  patrimonioUsd: number;
  personasActivas: number;
  proyectosActivos: number;
  formula: {
    totalContable: string;
    ebit: string;
    margen: string;
    burnRate: string;
    beneficioNeto: string;
    cashflowNeto: string;
    runway: string;
  };
  source: {
    facturado: string;
    directos: string;
    overhead: string;
    provisiones: string;
    cash: string;
    cajaTotal: string;
  };
}

export interface CashflowData {
  periodKey: string;
  label: string;
  cashInUsd: number;
  cashOutUsd: number;
  cashFlowNetoUsd: number;
  cajaTotalUsd: number;
  movementCount: number;
  formula: {
    neto: string;
  };
  source: {
    movements: string;
    cajaTotal: string;
  };
}

export async function getOperativoData(periodKeys: string[]): Promise<OperativoData> {
  const lastPeriodKey = periodKeys[periodKeys.length - 1];
  
  const devengadoResult = await getDevengadoSimple(periodKeys);
  const devengadoUsd = devengadoResult.devengadoUsd;
  
  const { rows: [costsData] } = await pool.query(`
    SELECT COALESCE(SUM(direct_usd), 0) as direct_costs_usd
    FROM fact_cost_month
    WHERE period_key = ANY($1)
  `, [periodKeys]);
  const directosUsd = parseFloat(costsData?.direct_costs_usd || '0');
  
  const { rows: [hoursData] } = await pool.query(`
    SELECT 
      COALESCE(SUM(asana_hours), 0) as total_hours,
      COALESCE(SUM(billing_hours), 0) as billable_hours,
      COUNT(DISTINCT person_id) FILTER (WHERE asana_hours > 0) as people_active
    FROM fact_labor_month
    WHERE period_key = ANY($1)
  `, [periodKeys]);
  
  const { rows: [projectsData] } = await pool.query(`
    SELECT COUNT(*) FILTER (WHERE status = 'active' AND parent_project_id IS NULL) as active
    FROM active_projects
  `);
  
  const ebitOperativoUsd = devengadoUsd - directosUsd;
  const margenOperativoPct = devengadoUsd > 0 ? (ebitOperativoUsd / devengadoUsd) * 100 : 0;
  const markupOperativo = directosUsd > 0 ? (devengadoUsd / directosUsd) : 0;
  
  const totalHours = parseFloat(hoursData?.total_hours || '0');
  const billableHours = parseFloat(hoursData?.billable_hours || '0');
  const horasFacturablesPct = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
  const tarifaEfectivaUsd = billableHours > 0 ? (devengadoUsd / billableHours) : 0;
  
  const [year, month] = lastPeriodKey.split('-').map(Number);
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const label = `${monthNames[month - 1]} de ${year}`;
  
  return {
    periodKey: lastPeriodKey,
    label,
    devengadoUsd,
    devengadoVariation: null,
    directosUsd,
    directosVariation: null,
    overheadOperativoUsd: 0,
    ebitOperativoUsd,
    ebitVariation: null,
    margenOperativoPct,
    markupOperativo,
    tarifaEfectivaUsd,
    tarifaVariation: null,
    horasFacturablesPct,
    horasTrabajadas: totalHours,
    personasActivas: parseInt(hoursData?.people_active || '0'),
    proyectosActivos: parseInt(projectsData?.active || '0'),
    formula: {
      ebit: 'Devengado - Directos',
      margen: 'EBIT Operativo / Devengado',
      markup: 'Devengado / Directos',
      tarifa: 'Devengado / Horas Facturables'
    },
    source: {
      devengado: 'monthly_financial_summary (Facturado - Provisión Fac. Adelantada)',
      directos: 'fact_cost_month.direct_usd',
      horas: 'fact_labor_month'
    }
  };
}

export async function getEconomicoData(periodKeys: string[]): Promise<EconomicoData> {
  const lastPeriodKey = periodKeys[periodKeys.length - 1];
  
  const devengadoResult = await getDevengadoSimple(periodKeys);
  const devengadoUsd = devengadoResult.devengadoUsd;
  
  const { rows: [costsData] } = await pool.query(`
    SELECT 
      COALESCE(SUM(direct_usd), 0) as direct_costs_usd,
      COALESCE(SUM(indirect_usd), 0) as indirect_costs_usd
    FROM fact_cost_month
    WHERE period_key = ANY($1)
  `, [periodKeys]);
  
  const { rows: [hoursData] } = await pool.query(`
    SELECT COUNT(DISTINCT person_id) FILTER (WHERE asana_hours > 0) as people_active
    FROM fact_labor_month
    WHERE period_key = ANY($1)
  `, [periodKeys]);
  
  const { rows: [projectsData] } = await pool.query(`
    SELECT COUNT(*) FILTER (WHERE status = 'active' AND parent_project_id IS NULL) as active
    FROM active_projects
  `);
  
  const directosUsd = parseFloat(costsData?.direct_costs_usd || '0');
  const overheadUsd = parseFloat(costsData?.indirect_costs_usd || '0');
  const totalCosts = directosUsd + overheadUsd;
  const overheadRatioPct = totalCosts > 0 ? (overheadUsd / totalCosts) * 100 : 0;
  const ebitEconomicoUsd = devengadoUsd - directosUsd - overheadUsd;
  const margenEconomicoPct = devengadoUsd > 0 ? (ebitEconomicoUsd / devengadoUsd) * 100 : 0;
  
  const [year, month] = lastPeriodKey.split('-').map(Number);
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const label = `${monthNames[month - 1]} de ${year}`;
  
  return {
    periodKey: lastPeriodKey,
    label,
    devengadoUsd,
    devengadoVariation: null,
    directosUsd,
    directosVariation: null,
    overheadUsd,
    overheadVariation: null,
    overheadRatioPct,
    ebitEconomicoUsd,
    ebitVariation: null,
    margenEconomicoPct,
    personasActivas: parseInt(hoursData?.people_active || '0'),
    proyectosActivos: parseInt(projectsData?.active || '0'),
    formula: {
      ebit: 'Devengado - Directos - Overhead',
      margen: 'EBIT Económico / Devengado'
    },
    source: {
      devengado: 'monthly_financial_summary (Facturado - Provisión Fac. Adelantada)',
      directos: 'fact_cost_month.direct_usd',
      overhead: 'fact_cost_month.indirect_usd'
    }
  };
}

export async function getFinanzasData(periodKeys: string[]): Promise<FinanzasData> {
  const lastPeriodKey = periodKeys[periodKeys.length - 1];
  
  const { rows: [excelData] } = await pool.query(`
    SELECT facturacion_total, caja_total, total_activo, total_pasivo
    FROM monthly_financial_summary
    WHERE period_key = $1
  `, [lastPeriodKey]);
  
  const facturadoUsd = parseFloat(excelData?.facturacion_total || '0');
  const cajaTotalUsd = parseFloat(excelData?.caja_total || '0');
  const activoTotalUsd = parseFloat(excelData?.total_activo || '0');
  const pasivoTotalUsd = parseFloat(excelData?.total_pasivo || '0');
  const patrimonioUsd = activoTotalUsd - pasivoTotalUsd;
  
  const { rows: [costsData] } = await pool.query(`
    SELECT 
      COALESCE(SUM(direct_usd), 0) as direct_costs_usd,
      COALESCE(SUM(indirect_usd), 0) as indirect_costs_usd
    FROM fact_cost_month
    WHERE period_key = ANY($1)
  `, [periodKeys]);
  
  const { rows: [hoursData] } = await pool.query(`
    SELECT COUNT(DISTINCT person_id) FILTER (WHERE asana_hours > 0) as people_active
    FROM fact_labor_month
    WHERE period_key = ANY($1)
  `, [periodKeys]);
  
  const { rows: [projectsData] } = await pool.query(`
    SELECT COUNT(*) FILTER (WHERE status = 'active' AND parent_project_id IS NULL) as active
    FROM active_projects
  `);
  
  const { rows: [provisionesData] } = await pool.query(`
    SELECT COALESCE(SUM(amount_usd), 0) as provisions_usd
    FROM pl_adjustments
    WHERE period_key = ANY($1)
  `, [periodKeys]);
  
  const { rows: [cashData] } = await pool.query(`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'IN' THEN amount_usd::numeric ELSE 0 END), 0) as cash_in_usd,
      COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount_usd::numeric ELSE 0 END), 0) as cash_out_usd
    FROM cash_movements
    WHERE period_key = ANY($1)
  `, [periodKeys]);
  
  const directosUsd = parseFloat(costsData?.direct_costs_usd || '0');
  const overheadUsd = parseFloat(costsData?.indirect_costs_usd || '0');
  const provisionesUsd = parseFloat(provisionesData?.provisions_usd || '0');
  const totalContableUsd = directosUsd + overheadUsd + provisionesUsd;
  const ebitContableUsd = facturadoUsd - totalContableUsd;
  const margenContablePct = facturadoUsd > 0 ? (ebitContableUsd / facturadoUsd) * 100 : 0;
  const burnRateUsd = totalContableUsd;
  const beneficioNetoUsd = ebitContableUsd - provisionesUsd;
  
  const cashInUsd = parseFloat(cashData?.cash_in_usd || '0');
  const cashOutUsd = parseFloat(cashData?.cash_out_usd || '0');
  const cashFlowNetoUsd = cashInUsd - cashOutUsd;
  const runwayMeses = burnRateUsd > 0 ? cajaTotalUsd / burnRateUsd : 0;
  
  const [year, month] = lastPeriodKey.split('-').map(Number);
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const label = `${monthNames[month - 1]} de ${year}`;
  
  return {
    periodKey: lastPeriodKey,
    label,
    facturadoUsd,
    facturadoVariation: null,
    directosUsd,
    overheadUsd,
    provisionesUsd,
    totalContableUsd,
    ebitContableUsd,
    ebitVariation: null,
    margenContablePct,
    burnRateUsd,
    beneficioNetoUsd,
    cashInUsd,
    cashOutUsd,
    cashFlowNetoUsd,
    cashFlowVariation: null,
    cajaTotalUsd,
    runwayMeses,
    activoTotalUsd,
    pasivoTotalUsd,
    patrimonioUsd,
    personasActivas: parseInt(hoursData?.people_active || '0'),
    proyectosActivos: parseInt(projectsData?.active || '0'),
    formula: {
      totalContable: 'Directos + Overhead + Provisiones',
      ebit: 'Facturado - Total Contable',
      margen: 'EBIT Contable / Facturado',
      burnRate: 'Directos + Overhead + Provisiones',
      beneficioNeto: 'EBIT Contable - Provisiones',
      cashflowNeto: 'Cash In - Cash Out',
      runway: 'Caja Total / Burn Rate'
    },
    source: {
      facturado: 'monthly_financial_summary.facturacion_total (Excel Maestro)',
      directos: 'fact_cost_month.direct_usd',
      overhead: 'fact_cost_month.indirect_usd',
      provisiones: 'pl_adjustments',
      cash: 'cash_movements',
      cajaTotal: 'monthly_financial_summary.caja_total (Excel Maestro)'
    }
  };
}

export async function getCashflowData(periodKeys: string[]): Promise<CashflowData> {
  const lastPeriodKey = periodKeys[periodKeys.length - 1];
  
  const { rows: [cashData] } = await pool.query(`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'IN' THEN amount_usd::numeric ELSE 0 END), 0) as cash_in_usd,
      COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount_usd::numeric ELSE 0 END), 0) as cash_out_usd,
      COUNT(*) as movement_count
    FROM cash_movements
    WHERE period_key = ANY($1)
  `, [periodKeys]);
  
  const { rows: [excelData] } = await pool.query(`
    SELECT caja_total
    FROM monthly_financial_summary
    WHERE period_key = $1
  `, [lastPeriodKey]);
  
  const cashInUsd = parseFloat(cashData?.cash_in_usd || '0');
  const cashOutUsd = parseFloat(cashData?.cash_out_usd || '0');
  const cashFlowNetoUsd = cashInUsd - cashOutUsd;
  const cajaTotalUsd = parseFloat(excelData?.caja_total || '0');
  
  const [year, month] = lastPeriodKey.split('-').map(Number);
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const label = `${monthNames[month - 1]} de ${year}`;
  
  return {
    periodKey: lastPeriodKey,
    label,
    cashInUsd,
    cashOutUsd,
    cashFlowNetoUsd,
    cajaTotalUsd,
    movementCount: parseInt(cashData?.movement_count || '0'),
    formula: {
      neto: 'Ingresos - Egresos'
    },
    source: {
      movements: 'cash_movements',
      cajaTotal: 'monthly_financial_summary.caja_total_usd (snapshot Excel Maestro)'
    }
  };
}
