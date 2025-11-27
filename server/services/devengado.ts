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
      (
        SELECT SUM(qi.estimated_hours)
        FROM quotation_items qi
        WHERE qi.quotation_id = q.id
      ) as hours_estimated
    FROM fact_rc_month frm
    JOIN active_projects ap ON frm.project_id = ap.id
    JOIN quotations q ON ap.quotation_id = q.id
    JOIN clients c ON ap.client_id = c.id
    WHERE frm.period_key = ANY($1)
    GROUP BY frm.project_id, ap.id, q.project_name, ap.subproject_name, c.name, 
             q.quotation_type, q.total_amount, q.quotation_currency, q.project_type, q.id
  `, [periodKeys]);
  
  const { rows: [costsData] } = await pool.query(`
    SELECT 
      COALESCE(SUM(direct_usd), 0) as direct_costs_usd
    FROM fact_cost_month
    WHERE period_key = ANY($1)
  `, [periodKeys]);
  
  const totalDirectCostsUsd = parseFloat(costsData?.direct_costs_usd || '0');
  
  const { rows: projectCostsData } = await pool.query(`
    SELECT 
      project_id,
      COALESCE(SUM(direct_usd), 0) as project_direct_costs_usd
    FROM fact_cost_month
    WHERE period_key = ANY($1) AND project_id IS NOT NULL
    GROUP BY project_id
  `, [periodKeys]);
  
  const projectCostsMap = new Map<number, number>();
  for (const row of projectCostsData) {
    projectCostsMap.set(row.project_id, parseFloat(row.project_direct_costs_usd || '0'));
  }
  
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

export async function getDevengadoSimple(periodKeys: string[]): Promise<{ devengadoUsd: number; facturadoUsd: number }> {
  const result = await getDevengadoByPeriod(periodKeys);
  return {
    devengadoUsd: result.totalDevengadoUsd,
    facturadoUsd: result.totalFacturadoUsd
  };
}
