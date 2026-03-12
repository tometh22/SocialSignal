import { Pool } from '@neondatabase/serverless';
import { 
  fetchDevengado, 
  fetchCosts, 
  fetchHours, 
  fetchProjectsActive, 
  fetchFinancialSummary, 
  fetchCashMovements,
  calculateOperativoKPIs,
  calculateEconomicoKPIs,
  calculateFinancieroKPIs,
  FORMULA_DESCRIPTIONS,
  DATA_SOURCES
} from './kpi-formulas.js';

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
  
  const [devengadoUsd, costs, hours, proyectosActivos] = await Promise.all([
    fetchDevengado(periodKeys),
    fetchCosts(periodKeys),
    fetchHours(periodKeys),
    fetchProjectsActive()
  ]);
  
  const kpis = calculateOperativoKPIs(
    devengadoUsd,
    costs.directos,
    hours.total,
    hours.billable,
    hours.peopleActive,
    proyectosActivos
  );
  
  const [year, month] = lastPeriodKey.split('-').map(Number);
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const label = `${monthNames[month - 1]} de ${year}`;
  
  return {
    periodKey: lastPeriodKey,
    label,
    devengadoUsd: kpis.devengadoUsd,
    devengadoVariation: null,
    directosUsd: kpis.directosUsd,
    directosVariation: null,
    overheadOperativoUsd: 0,
    ebitOperativoUsd: kpis.ebitOperativoUsd,
    ebitVariation: null,
    margenOperativoPct: kpis.margenOperativoPct,
    markupOperativo: kpis.markupOperativo,
    tarifaEfectivaUsd: kpis.tarifaEfectivaUsd,
    tarifaVariation: null,
    horasFacturablesPct: kpis.horasFacturablesPct,
    horasTrabajadas: kpis.horasTrabajadas,
    personasActivas: kpis.personasActivas,
    proyectosActivos: kpis.proyectosActivos,
    formula: {
      ebit: FORMULA_DESCRIPTIONS.operativo.ebit,
      margen: FORMULA_DESCRIPTIONS.operativo.margen,
      markup: FORMULA_DESCRIPTIONS.operativo.markup,
      tarifa: FORMULA_DESCRIPTIONS.operativo.tarifa
    },
    source: {
      devengado: DATA_SOURCES.devengado,
      directos: DATA_SOURCES.directos,
      horas: DATA_SOURCES.horas
    }
  };
}

export async function getEconomicoData(periodKeys: string[]): Promise<EconomicoData> {
  const lastPeriodKey = periodKeys[periodKeys.length - 1];
  
  const [devengadoUsd, costs, hours, proyectosActivos] = await Promise.all([
    fetchDevengado(periodKeys),
    fetchCosts(periodKeys),
    fetchHours(periodKeys),
    fetchProjectsActive()
  ]);
  
  const kpis = calculateEconomicoKPIs(
    devengadoUsd,
    costs.directos,
    costs.overhead,
    hours.peopleActive,
    proyectosActivos
  );
  
  const [year, month] = lastPeriodKey.split('-').map(Number);
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const label = `${monthNames[month - 1]} de ${year}`;
  
  return {
    periodKey: lastPeriodKey,
    label,
    devengadoUsd: kpis.devengadoUsd,
    devengadoVariation: null,
    directosUsd: kpis.directosUsd,
    directosVariation: null,
    overheadUsd: kpis.overheadUsd,
    overheadVariation: null,
    overheadRatioPct: kpis.overheadRatioPct,
    ebitEconomicoUsd: kpis.ebitEconomicoUsd,
    ebitVariation: null,
    margenEconomicoPct: kpis.margenEconomicoPct,
    personasActivas: kpis.personasActivas,
    proyectosActivos: kpis.proyectosActivos,
    formula: {
      ebit: FORMULA_DESCRIPTIONS.economico.ebit,
      margen: FORMULA_DESCRIPTIONS.economico.margen
    },
    source: {
      devengado: DATA_SOURCES.devengado,
      directos: DATA_SOURCES.directos,
      overhead: DATA_SOURCES.overhead
    }
  };
}

export async function getFinanzasData(periodKeys: string[]): Promise<FinanzasData> {
  const lastPeriodKey = periodKeys[periodKeys.length - 1];
  
  const [costs, hours, proyectosActivos, financialSummary, cashMovements] = await Promise.all([
    fetchCosts(periodKeys),
    fetchHours(periodKeys),
    fetchProjectsActive(),
    fetchFinancialSummary(lastPeriodKey),
    fetchCashMovements(periodKeys)
  ]);
  
  const kpis = calculateFinancieroKPIs(
    financialSummary.facturado,
    costs.directos,
    costs.overhead,
    costs.provisiones,
    cashMovements.cashIn,
    cashMovements.cashOut,
    financialSummary.cajaTotal,
    financialSummary.activoTotal,
    financialSummary.pasivoTotal,
    hours.peopleActive,
    proyectosActivos
  );
  
  // beneficioNeto = EBIT Contable (ya incluye la deducción de provisiones)
  // EBIT Contable = Facturado - Directos - Overhead - Provisiones
  // NO restar provisiones de nuevo (eso sería doble conteo)
  const beneficioNetoUsd = kpis.ebitContableUsd;
  
  const [year, month] = lastPeriodKey.split('-').map(Number);
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const label = `${monthNames[month - 1]} de ${year}`;
  
  return {
    periodKey: lastPeriodKey,
    label,
    facturadoUsd: kpis.facturadoUsd,
    facturadoVariation: null,
    directosUsd: kpis.directosUsd,
    overheadUsd: kpis.overheadUsd,
    provisionesUsd: kpis.provisionesUsd,
    totalContableUsd: kpis.totalContableUsd,
    ebitContableUsd: kpis.ebitContableUsd,
    ebitVariation: null,
    margenContablePct: kpis.margenContablePct,
    burnRateUsd: kpis.burnRateUsd,
    beneficioNetoUsd,
    cashInUsd: kpis.cashInUsd,
    cashOutUsd: kpis.cashOutUsd,
    cashFlowNetoUsd: kpis.cashFlowNetoUsd,
    cashFlowVariation: null,
    cajaTotalUsd: kpis.cajaTotalUsd,
    runwayMeses: kpis.runwayMeses,
    activoTotalUsd: kpis.activoTotalUsd,
    pasivoTotalUsd: kpis.pasivoTotalUsd,
    patrimonioUsd: kpis.patrimonioUsd,
    personasActivas: kpis.personasActivas,
    proyectosActivos: kpis.proyectosActivos,
    formula: {
      totalContable: FORMULA_DESCRIPTIONS.financiero.burnRate,
      ebit: FORMULA_DESCRIPTIONS.financiero.ebit,
      margen: FORMULA_DESCRIPTIONS.financiero.margen,
      burnRate: FORMULA_DESCRIPTIONS.financiero.burnRate,
      beneficioNeto: 'EBIT Contable − Provisiones',
      cashflowNeto: FORMULA_DESCRIPTIONS.financiero.cashFlow,
      runway: FORMULA_DESCRIPTIONS.financiero.runway
    },
    source: {
      facturado: DATA_SOURCES.facturado,
      directos: DATA_SOURCES.directos,
      overhead: DATA_SOURCES.overhead,
      provisiones: DATA_SOURCES.provisiones,
      cash: DATA_SOURCES.cash,
      cajaTotal: DATA_SOURCES.cajaTotal
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
  // FIX: null caja_total = data missing (not zero); negative = valid overdraft
  const cajaTotalUsd = excelData?.caja_total != null ? parseFloat(excelData.caja_total) : 0;
  
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
