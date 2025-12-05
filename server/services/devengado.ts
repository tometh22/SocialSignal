import { pool } from '../db.js';

interface DevengadoProjectBreakdown {
  projectId: number;
  projectName: string;
  clientName: string;
  projectType: 'fee' | 'one-shot' | 'other';
  facturadoUsd: number;
  devengadoUsd: number;
  hoursWorked: number;
  hoursEstimated: number | null;
  progressPct: number | null;
  calculationMethod: 'fee_equals_billed' | 'progress_based' | 'fallback_markup';
}

interface DevengadoResult {
  totalDevengadoUsd: number;
  totalFacturadoUsd: number;
  byProject: DevengadoProjectBreakdown[];
  stats: {
    feeProjects: number;
    oneShotProjects: number;
    fallbackProjects: number;
  };
}

const FALLBACK_MARKUP = 2.5;

export async function getDevengadoByPeriod(periodKeys: string[]): Promise<DevengadoResult> {
  console.log(`🔄 DEVENGADO: Calculating for periods: ${periodKeys.join(', ')}`);
  
  const byProject: DevengadoProjectBreakdown[] = [];
  let totalDevengadoUsd = 0;
  let totalFacturadoUsd = 0;
  let stats = { feeProjects: 0, oneShotProjects: 0, fallbackProjects: 0 };
  
  const { rows: projectsData } = await pool.query(`
    SELECT 
      frm.project_id,
      ap.id as active_project_id,
      COALESCE(q.project_name, ap.subproject_name, 'Unknown') as project_name,
      c.name as client_name,
      q.quotation_type,
      q.total_amount as contract_value,
      q.quotation_currency,
      q.project_type,
      SUM(frm.revenue_usd) as facturado_usd,
      (
        SELECT COALESCE(SUM(flm.asana_hours), 0)
        FROM fact_labor_month flm
        WHERE flm.project_id = frm.project_id AND flm.period_key = ANY($1)
      ) as hours_worked_period,
      (
        SELECT COALESCE(SUM(flm.asana_hours), 0)
        FROM fact_labor_month flm
        WHERE flm.project_id = frm.project_id
      ) as hours_worked_total,
      NULL::numeric as hours_estimated
    FROM fact_rc_month frm
    JOIN active_projects ap ON frm.project_id = ap.id
    LEFT JOIN quotations q ON ap.quotation_id = q.id
    LEFT JOIN clients c ON ap.client_id = c.id
    WHERE frm.period_key = ANY($1)
    GROUP BY frm.project_id, ap.id, q.project_name, ap.subproject_name, c.name, 
             q.quotation_type, q.total_amount, q.quotation_currency, q.project_type
  `, [periodKeys]);
  
  const { rows: [costsData] } = await pool.query(`
    SELECT 
      COALESCE(SUM(direct_usd), 0) as direct_costs_usd
    FROM fact_cost_month
    WHERE period_key = ANY($1)
  `, [periodKeys]);
  
  const totalDirectCostsUsd = parseFloat(costsData?.direct_costs_usd || '0');
  
  const projectCostsMap = new Map<number, number>();
  
  for (const project of projectsData) {
    const projectId = project.project_id;
    const projectName = project.project_name;
    const clientName = project.client_name;
    const quotationType = project.quotation_type?.toLowerCase() || 'other';
    const facturadoUsd = parseFloat(project.facturado_usd || '0');
    const hoursWorked = parseFloat(project.hours_worked_period || '0');
    const hoursWorkedTotal = parseFloat(project.hours_worked_total || '0');
    const hoursEstimated = project.hours_estimated ? parseFloat(project.hours_estimated) : null;
    const contractValue = parseFloat(project.contract_value || '0');
    
    totalFacturadoUsd += facturadoUsd;
    
    let devengadoUsd = 0;
    let progressPct: number | null = null;
    let calculationMethod: 'fee_equals_billed' | 'progress_based' | 'fallback_markup';
    let projectType: 'fee' | 'one-shot' | 'other';
    
    if (quotationType === 'fee' || quotationType === 'recurring') {
      projectType = 'fee';
      devengadoUsd = facturadoUsd;
      calculationMethod = 'fee_equals_billed';
      stats.feeProjects++;
      
      console.log(`   📗 [FEE] ${clientName} | ${projectName}: devengado = facturado = $${devengadoUsd.toFixed(2)}`);
      
    } else if (quotationType === 'one-time') {
      projectType = 'one-shot';
      
      if (hoursEstimated && hoursEstimated > 0 && contractValue > 0) {
        const sortedPeriods = [...periodKeys].sort();
        const minPeriod = sortedPeriods[0];
        const maxPeriod = sortedPeriods[sortedPeriods.length - 1];
        
        const { rows: [cumHoursRow] } = await pool.query(`
          SELECT COALESCE(SUM(flm.asana_hours), 0) as cum_hours
          FROM fact_labor_month flm
          WHERE flm.project_id = $1 
            AND flm.period_key <= $2
        `, [projectId, maxPeriod]);
        
        const cumHoursEndPeriod = parseFloat(cumHoursRow?.cum_hours || '0');
        const rawProgressPct = cumHoursEndPeriod / hoursEstimated;
        progressPct = Math.min(1, rawProgressPct);
        
        const { rows: [prevHoursRow] } = await pool.query(`
          SELECT COALESCE(SUM(flm.asana_hours), 0) as prev_hours
          FROM fact_labor_month flm
          WHERE flm.project_id = $1 
            AND flm.period_key < $2
        `, [projectId, minPeriod]);
        
        const prevHours = parseFloat(prevHoursRow?.prev_hours || '0');
        const prevProgressPct = Math.min(1, prevHours / hoursEstimated);
        
        const devengadoAcumuladoActual = contractValue * progressPct;
        const devengadoAcumuladoPrev = contractValue * prevProgressPct;
        devengadoUsd = Math.max(0, devengadoAcumuladoActual - devengadoAcumuladoPrev);
        
        calculationMethod = 'progress_based';
        stats.oneShotProjects++;
        
        console.log(`   📘 [ONE-SHOT] ${clientName} | ${projectName}: progress=${(progressPct*100).toFixed(1)}% (${cumHoursEndPeriod.toFixed(0)}/${hoursEstimated}h), devengado=$${devengadoUsd.toFixed(2)}`);
        
      } else {
        const projectDirectCosts = projectCostsMap.get(projectId) || 0;
        if (projectDirectCosts > 0) {
          devengadoUsd = projectDirectCosts * FALLBACK_MARKUP;
          calculationMethod = 'fallback_markup';
          console.log(`   ⚠️ [FALLBACK-COSTS] ${clientName} | ${projectName}: using costs*${FALLBACK_MARKUP}=$${devengadoUsd.toFixed(2)}`);
        } else if (facturadoUsd > 0) {
          devengadoUsd = facturadoUsd;
          calculationMethod = 'fee_equals_billed';
          console.log(`   ⚠️ [FALLBACK-BILLED] ${clientName} | ${projectName}: no costs, using facturado=$${devengadoUsd.toFixed(2)}`);
        } else {
          devengadoUsd = 0;
          calculationMethod = 'fallback_markup';
          console.log(`   ⚠️ [FALLBACK-ZERO] ${clientName} | ${projectName}: no data available, devengado=$0`);
        }
        stats.fallbackProjects++;
      }
      
    } else {
      projectType = 'other';
      devengadoUsd = facturadoUsd;
      calculationMethod = 'fee_equals_billed';
      stats.feeProjects++;
      
      console.log(`   📙 [OTHER] ${clientName} | ${projectName}: type=${quotationType}, using facturado=$${devengadoUsd.toFixed(2)}`);
    }
    
    totalDevengadoUsd += devengadoUsd;
    
    byProject.push({
      projectId,
      projectName,
      clientName,
      projectType,
      facturadoUsd,
      devengadoUsd,
      hoursWorked,
      hoursEstimated,
      progressPct,
      calculationMethod
    });
  }
  
  if (projectsData.length === 0 && totalDirectCostsUsd > 0) {
    console.log(`   ⚠️ [GLOBAL FALLBACK] No project data, using costs * ${FALLBACK_MARKUP}: $${(totalDirectCostsUsd * FALLBACK_MARKUP).toFixed(2)}`);
    totalDevengadoUsd = totalDirectCostsUsd * FALLBACK_MARKUP;
    stats.fallbackProjects = 1;
  }
  
  console.log(`📊 DEVENGADO SUMMARY:`);
  console.log(`   Total Facturado: $${totalFacturadoUsd.toFixed(2)}`);
  console.log(`   Total Devengado: $${totalDevengadoUsd.toFixed(2)}`);
  console.log(`   Projects: ${stats.feeProjects} Fee, ${stats.oneShotProjects} One-Shot, ${stats.fallbackProjects} Fallback`);
  
  return {
    totalDevengadoUsd,
    totalFacturadoUsd,
    byProject,
    stats
  };
}

export async function getDevengadoSimple(periodKeys: string[]): Promise<{ devengadoUsd: number; facturadoUsd: number; source: string }> {
  // NUEVA FÓRMULA: Devengado = Facturado - Provisión Facturación Adelantada
  // Fuente: Excel MAESTRO "Resumen Ejecutivo"
  // Facturado = "Ventas del mes" (columna facturacion_total)
  // Provisión = "Provisión Pasivo Costos Facturación Adelantada" (columna pasivo_facturacion_adelantada)
  
  const { rows: mfsData } = await pool.query(`
    SELECT 
      COALESCE(SUM(facturacion_total), 0) as facturado_total,
      COALESCE(SUM(pasivo_facturacion_adelantada), 0) as provision_adelantada
    FROM monthly_financial_summary
    WHERE period_key = ANY($1)
  `, [periodKeys]);
  
  const facturadoUsd = parseFloat(mfsData[0]?.facturado_total || '0');
  const provisionAdelantada = parseFloat(mfsData[0]?.provision_adelantada || '0');
  
  // Devengado = Facturado - Provisión Adelantada
  const devengadoUsd = facturadoUsd - provisionAdelantada;
  
  console.log(`📊 DEVENGADO (Excel MAESTRO formula):`);
  console.log(`   Periods: ${periodKeys.join(', ')}`);
  console.log(`   Facturado (Ventas del mes): $${facturadoUsd.toFixed(2)}`);
  console.log(`   Provisión Adelantada: $${provisionAdelantada.toFixed(2)}`);
  console.log(`   Devengado (Facturado - Provisión): $${devengadoUsd.toFixed(2)}`);
  
  return {
    devengadoUsd,
    facturadoUsd,
    source: 'excel_maestro'
  };
}

export async function getDevengadoByProject(periodKeys: string[]): Promise<DevengadoResult> {
  // Este método mantiene el cálculo por proyecto para análisis operativo detallado
  return getDevengadoByPeriod(periodKeys);
}
