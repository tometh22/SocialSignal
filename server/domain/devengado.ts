/**
 * Módulo de Cálculo de Devengado y WIP
 * 
 * Implementa modelo híbrido automático:
 * - Fee → costos × markup (2.5)
 * - One-Shot → % avance del contrato
 * - Mixto → combina ambas
 * 
 * Fórmula estándar de revenue recognition:
 * devengado_mes = facturado_mes + (WIP_t - WIP_t-1)
 * margen_económico = devengado_mes - costo_mes
 * margen_contable = facturado_mes - costo_mes
 */

import { pool } from '../db';

export interface DevengadoMetrics {
  facturadoMesUsd: number;           // facturado del mes (desde Excel)
  facturadoAcumUsd: number;          // facturado acumulado
  
  costoMesUsd: number;               // costos del mes
  costoAcumUsd: number;              // costos acumulados
  
  devengadoMesUsd: number;           // devengado del mes (facturado + ΔWIP)
  devengadoAcumUsd: number;          // devengado acumulado
  
  wipAcumMesUsd: number;             // WIP al cierre del mes
  wipAcumMesAnteriorUsd: number;    // WIP del mes anterior
  wipDeltaUsd: number;               // ΔWIP = WIP_t - WIP_t-1
  
  marginContableMesUsd: number;      // facturado - costos
  marginEconomicoMesUsd: number;     // devengado - costos
  
  marginContableAcumUsd: number;     // facturado_acum - costos_acum
  marginEconomicoAcumUsd: number;    // devengado_acum - costos_acum
}

export interface ProjectDevengadoInput {
  projectId: number;
  projectType: 'fee' | 'one-shot' | 'mixed';  // del quotationType
  periodKey: string;                          // YYYY-MM
  
  // Contrato (para one-shot)
  contractValueUsd?: number;
  estimatedHoursTotal?: number;
}

/**
 * Calcula devengado económico para un proyecto en un mes
 */
export async function calculateDevengadoForMonth(input: ProjectDevengadoInput): Promise<DevengadoMetrics> {
  const { projectId, projectType, periodKey, contractValueUsd, estimatedHoursTotal } = input;
  
  // 1. Obtener facturado del mes (desde fact_rc_month)
  const { rows: [rcData] } = await pool.query(
    `SELECT COALESCE(revenue_usd, 0)::numeric as revenue_usd FROM fact_rc_month
     WHERE project_id = $1 AND period_key = $2`,
    [projectId, periodKey]
  );
  const facturadoMesUsd = parseFloat(rcData?.revenue_usd || '0');
  
  // 2. Obtener costos del mes (desde fact_labor_month)
  const { rows: [costData] } = await pool.query(
    `SELECT COALESCE(SUM(cost_usd), 0)::numeric as total_cost_usd FROM fact_labor_month
     WHERE project_id = $1 AND period_key = $2`,
    [projectId, periodKey]
  );
  const costoMesUsd = parseFloat(costData?.total_cost_usd || '0');
  
  // 3. Obtener horas billables del mes (para markup)
  const { rows: [hoursData] } = await pool.query(
    `SELECT COALESCE(SUM(billing_hours), 0)::numeric as billing_hours FROM fact_labor_month
     WHERE project_id = $1 AND period_key = $2`,
    [projectId, periodKey]
  );
  const horasBillablesMesUsd = parseFloat(hoursData?.billing_hours || '0');
  
  // 4. Calcular acumulados hasta esta fecha
  const [yearStr, monthStr] = periodKey.split('-').map(Number);
  const currDate = new Date(yearStr, monthStr - 1, 1);
  
  // Obtener facturado acumulado
  const { rows: [facAccumData] } = await pool.query(
    `SELECT COALESCE(SUM(revenue_usd), 0)::numeric as total_revenue_usd 
     FROM fact_rc_month
     WHERE project_id = $1 
       AND period_key <= $2
     ORDER BY period_key`,
    [projectId, periodKey]
  );
  const facturadoAcumUsd = parseFloat(facAccumData?.total_revenue_usd || '0');
  
  // Obtener costos acumulados
  const { rows: [costAccumData] } = await pool.query(
    `SELECT COALESCE(SUM(f.cost_usd), 0)::numeric as total_cost_usd 
     FROM fact_labor_month f
     WHERE f.project_id = $1 
       AND f.period_key <= $2`,
    [projectId, periodKey]
  );
  const costoAcumUsd = parseFloat(costAccumData?.total_cost_usd || '0');
  
  // Obtener horas billables acumuladas
  const { rows: [hoursAccumData] } = await pool.query(
    `SELECT COALESCE(SUM(billing_hours), 0)::numeric as total_billing_hours 
     FROM fact_labor_month
     WHERE project_id = $1 
       AND period_key <= $2`,
    [projectId, periodKey]
  );
  const horasBilablesAcumUsd = parseFloat(hoursAccumData?.total_billing_hours || '0');
  
  // 5. Calcular WIP acumulado según tipo de proyecto
  let wipAcumMesUsd = 0;
  let devengadoAcumUsd = 0;
  
  if (projectType === 'fee') {
    // FEE: devengado_acum = costos_acum × markup (2.5)
    devengadoAcumUsd = costoAcumUsd * 2.5;
    wipAcumMesUsd = devengadoAcumUsd - facturadoAcumUsd;
  } else if (projectType === 'one-shot' && contractValueUsd && estimatedHoursTotal) {
    // ONE-SHOT: devengado_acum = contrato × (horas_acum / horas_estimadas)
    const avancePct = Math.min(horasBilablesAcumUsd / estimatedHoursTotal, 1.0);
    devengadoAcumUsd = contractValueUsd * avancePct;
    wipAcumMesUsd = devengadoAcumUsd - facturadoAcumUsd;
  } else if (projectType === 'mixed' && contractValueUsd && estimatedHoursTotal) {
    // MIXTO: suma de fee + one-shot
    // Asumir 50/50 para simplificar (el usuario podría especificar)
    const feePartAcum = (costoAcumUsd * 0.5) * 2.5;
    const osPartAcum = (contractValueUsd * 0.5) * Math.min(horasBilablesAcumUsd / estimatedHoursTotal, 1.0);
    devengadoAcumUsd = feePartAcum + osPartAcum;
    wipAcumMesUsd = devengadoAcumUsd - facturadoAcumUsd;
  } else {
    // Fallback: usar markup sobre costos
    devengadoAcumUsd = costoAcumUsd * 2.5;
    wipAcumMesUsd = devengadoAcumUsd - facturadoAcumUsd;
  }
  
  // 6. Obtener WIP del mes anterior
  const prevPeriodKey = getPreviousPeriodKey(periodKey);
  let wipAcumMesAnteriorUsd = 0;
  
  if (prevPeriodKey) {
    // Recalcular WIP para mes anterior
    const { rows: [prevRcData] } = await pool.query(
      `SELECT COALESCE(SUM(revenue_usd), 0)::numeric as total_revenue_usd 
       FROM fact_rc_month
       WHERE project_id = $1 AND period_key <= $2`,
      [projectId, prevPeriodKey]
    );
    const facAccumPrev = parseFloat(prevRcData?.total_revenue_usd || '0');
    
    const { rows: [prevCostData] } = await pool.query(
      `SELECT COALESCE(SUM(cost_usd), 0)::numeric as total_cost_usd 
       FROM fact_labor_month
       WHERE project_id = $1 AND period_key <= $2`,
      [projectId, prevPeriodKey]
    );
    const costAccumPrev = parseFloat(prevCostData?.total_cost_usd || '0');
    
    const { rows: [prevHoursData] } = await pool.query(
      `SELECT COALESCE(SUM(billing_hours), 0)::numeric as total_billing_hours 
       FROM fact_labor_month
       WHERE project_id = $1 AND period_key <= $2`,
      [projectId, prevPeriodKey]
    );
    const hoursAccumPrev = parseFloat(prevHoursData?.total_billing_hours || '0');
    
    // Calcular devengado_acum para mes anterior
    let devengadoAccumPrev = 0;
    if (projectType === 'fee') {
      devengadoAccumPrev = costAccumPrev * 2.5;
    } else if (projectType === 'one-shot' && contractValueUsd && estimatedHoursTotal) {
      const avancePctPrev = Math.min(hoursAccumPrev / estimatedHoursTotal, 1.0);
      devengadoAccumPrev = contractValueUsd * avancePctPrev;
    }
    
    wipAcumMesAnteriorUsd = devengadoAccumPrev - facAccumPrev;
  }
  
  // 7. Calcular ΔWIP del mes
  const wipDeltaUsd = wipAcumMesUsd - wipAcumMesAnteriorUsd;
  
  // 8. Devengado del mes = facturado_mes + ΔWIP
  const devengadoMesUsd = facturadoMesUsd + wipDeltaUsd;
  
  // 9. Márgenes
  const marginContableMesUsd = facturadoMesUsd - costoMesUsd;
  const marginEconomicoMesUsd = devengadoMesUsd - costoMesUsd;
  const marginContableAcumUsd = facturadoAcumUsd - costoAcumUsd;
  const marginEconomicoAcumUsd = devengadoAcumUsd - costoAcumUsd;
  
  return {
    facturadoMesUsd,
    facturadoAcumUsd,
    costoMesUsd,
    costoAcumUsd,
    devengadoMesUsd,
    devengadoAcumUsd,
    wipAcumMesUsd,
    wipAcumMesAnteriorUsd,
    wipDeltaUsd,
    marginContableMesUsd,
    marginEconomicoMesUsd,
    marginContableAcumUsd,
    marginEconomicoAcumUsd,
  };
}

/**
 * Calcula devengado agregado para múltiples períodos
 */
export async function calculateDevengadoAggregated(
  projectIds: number[],
  periodKeys: string[],
  projectTypeMap: Map<number, 'fee' | 'one-shot' | 'mixed'>,
  contractMap: Map<number, { value: number; hours: number }>
): Promise<DevengadoMetrics> {
  
  let totalFacturadoMesUsd = 0;
  let totalFacturadoAcumUsd = 0;
  let totalCostoMesUsd = 0;
  let totalCostoAcumUsd = 0;
  let totalDevengadoMesUsd = 0;
  let totalDevengadoAcumUsd = 0;
  let totalWipAcumUsd = 0;
  let totalWipAcumAnteriorUsd = 0;
  
  for (const projectId of projectIds) {
    const projectType = projectTypeMap.get(projectId) || 'fee';
    const contract = contractMap.get(projectId);
    
    for (const periodKey of periodKeys) {
      const metrics = await calculateDevengadoForMonth({
        projectId,
        projectType,
        periodKey,
        contractValueUsd: contract?.value,
        estimatedHoursTotal: contract?.hours,
      });
      
      totalFacturadoMesUsd += metrics.facturadoMesUsd;
      totalCostoMesUsd += metrics.costoMesUsd;
      totalDevengadoMesUsd += metrics.devengadoMesUsd;
    }
  }
  
  // Obtener acumulados totales
  const { rows: [facAccumData] } = await pool.query(
    `SELECT COALESCE(SUM(revenue_usd), 0)::numeric as total 
     FROM fact_rc_month
     WHERE project_id = ANY($1) AND period_key = ANY($2)`,
    [projectIds, periodKeys]
  );
  totalFacturadoAcumUsd = parseFloat(facAccumData?.total || '0');
  
  const { rows: [costAccumData] } = await pool.query(
    `SELECT COALESCE(SUM(cost_usd), 0)::numeric as total 
     FROM fact_labor_month
     WHERE project_id = ANY($1) AND period_key = ANY($2)`,
    [projectIds, periodKeys]
  );
  totalCostoAcumUsd = parseFloat(costAccumData?.total || '0');
  
  // Para agregado, estimar WIP como markup sobre costos
  totalDevengadoAcumUsd = totalCostoAcumUsd * 2.5;
  totalWipAcumUsd = totalDevengadoAcumUsd - totalFacturadoAcumUsd;
  
  return {
    facturadoMesUsd: totalFacturadoMesUsd,
    facturadoAcumUsd: totalFacturadoAcumUsd,
    costoMesUsd: totalCostoMesUsd,
    costoAcumUsd: totalCostoAcumUsd,
    devengadoMesUsd: totalDevengadoMesUsd,
    devengadoAcumUsd: totalDevengadoAcumUsd,
    wipAcumMesUsd: totalWipAcumUsd,
    wipAcumMesAnteriorUsd: totalWipAcumAnteriorUsd,
    wipDeltaUsd: totalWipAcumUsd - totalWipAcumAnteriorUsd,
    marginContableMesUsd: totalFacturadoMesUsd - totalCostoMesUsd,
    marginEconomicoMesUsd: totalDevengadoMesUsd - totalCostoMesUsd,
    marginContableAcumUsd: totalFacturadoAcumUsd - totalCostoAcumUsd,
    marginEconomicoAcumUsd: totalDevengadoAcumUsd - totalCostoAcumUsd,
  };
}

/**
 * Obtiene el período anterior a uno dado
 */
function getPreviousPeriodKey(periodKey: string): string | null {
  const [yearStr, monthStr] = periodKey.split('-').map(Number);
  if (monthStr > 1) {
    return `${yearStr}-${String(monthStr - 1).padStart(2, '0')}`;
  } else if (yearStr > 2020) {
    return `${yearStr - 1}-12`;
  }
  return null;
}
