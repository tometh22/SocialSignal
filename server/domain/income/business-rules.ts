/**
 * 🚀 REGLAS DE NEGOCIO - FILTRO, NORMALIZACIÓN Y AGREGACIÓN
 * Lógica central del dominio de ingresos
 */

import type { IncomeRow, ProjectIncome, IncomeResult, PortfolioIncome, PeriodKey } from './types';
import { periodKeyOf } from './parser';
import { getFx } from './fx';
import { resolveProjectId } from './data-access';

type GroupKey = string; // `${clientName}|||${projectName}`

/**
 * Construye el resultado completo de ingresos para un período
 * Aplica todas las reglas de negocio especificadas
 */
export async function buildIncomeResult(
  period: PeriodKey, 
  rows: IncomeRow[], 
  totalProjects: number
): Promise<IncomeResult> {
  
  console.log(`🚀 INCOME SoT: Building result for period ${period} with ${rows.length} raw rows`);
  
  // 1) FILTRO TEMPORAL + CONFIRMADOS
  const accepted = rows.filter(r => {
    try {
      const rowPeriod = periodKeyOf(r.monthEs, r.year);
      const isConfirmed = r.confirmed;
      const hasValidPeriod = rowPeriod === period;
      
      if (!hasValidPeriod) {
        console.log(`❌ REJECTED (period): ${r.clientName}/${r.projectName} - ${rowPeriod} != ${period}`);
        return false;
      }
      
      if (!isConfirmed) {
        console.log(`❌ REJECTED (not confirmed): ${r.clientName}/${r.projectName}`);
        return false;
      }
      
      console.log(`✅ ACCEPTED: ${r.clientName}/${r.projectName} - ARS:${r.amountARS} USD:${r.amountUSD}`);
      return true;
      
    } catch (error) {
      console.log(`❌ REJECTED (parse error): ${r.clientName}/${r.projectName} - ${error}`);
      return false;
    }
  });

  console.log(`🚀 INCOME SoT: ${accepted.length}/${rows.length} rows accepted for period ${period}`);

  // 2) AGRUPAR POR PROYECTO (cliente + proyecto)
  const groups = new Map<GroupKey, IncomeRow[]>();
  for (const r of accepted) {
    if (!r.clientName || !r.projectName) {
      console.log(`❌ SKIPPED (missing name): client="${r.clientName}" project="${r.projectName}"`);
      continue;
    }
    
    const k = `${r.clientName}|||${r.projectName}`;
    if (!groups.has(k)) {
      groups.set(k, []);
    }
    groups.get(k)!.push(r);
  }

  console.log(`🚀 INCOME SoT: Grouped into ${groups.size} unique projects`);

  // 3) OBTENER FX PARA EL PERÍODO
  const fx = await getFx(period);
  console.log(`🚀 INCOME SoT: Using FX rate ${fx} for period ${period}`);

  const projects: ProjectIncome[] = [];

  // 4) PROCESAR CADA GRUPO DE PROYECTO
  for (const [k, list] of groups) {
    const [clientName, projectName] = k.split('|||');

    // 5) REGLA DE MONEDA NATIVA (DISPLAY)
    // Si hay algún USD > 0 en el proyecto/periodo → display USD
    // Else si hay ARS > 0 → display ARS
    // Else → display USD con 0
    const sumUSD = list.reduce((a, r) => a + (r.amountUSD || 0), 0);
    const sumARS = list.reduce((a, r) => a + (r.amountARS || 0), 0);

    const revenueDisplay =
      sumUSD > 0 ? { amount: sumUSD, currency: 'USD' as const } :
      sumARS > 0 ? { amount: sumARS, currency: 'ARS' as const } :
      { amount: 0, currency: 'USD' as const };

    // 6) NORMALIZACIÓN A USD PARA KPIs (regla estricta por registro)
    const revenueUSDNormalized = list.reduce((acc, r) => {
      if (r.amountUSD > 0) return acc + r.amountUSD;
      if (r.amountARS > 0) return acc + (r.amountARS / fx);
      return acc;
    }, 0);

    console.log(`📊 PROJECT: ${clientName}/${projectName}`);
    console.log(`   Display: ${revenueDisplay.currency} ${revenueDisplay.amount.toLocaleString()}`);
    console.log(`   USD Normalized: ${revenueUSDNormalized.toFixed(2)}`);

    // 7) RESOLVER PROJECT ID
    const projectId = await resolveProjectId(clientName, projectName);

    // 8) CREAR REGISTRO DEL PROYECTO
    projects.push({
      projectId,
      clientName,
      projectName,
      revenueDisplay,
      revenueUSDNormalized,
      records: list.map(r => r.amountUSD > 0
        ? ({ currency: 'USD' as const, amount: r.amountUSD })
        : ({ currency: 'ARS' as const, amount: r.amountARS })
      ),
    });
  }

  // 9) CALCULAR RESUMEN DEL PORTFOLIO
  const periodRevenueUSD = projects.reduce((a, p) => a + p.revenueUSDNormalized, 0);
  const projectsWithIncome = projects.filter(p => p.revenueUSDNormalized > 0).length;
  
  const summary: PortfolioIncome = {
    period,
    periodRevenueUSD,
    projectsWithIncome,
    totalProjects
  };

  console.log(`🚀 INCOME SoT SUMMARY: ${projectsWithIncome}/${totalProjects} projects with income, total: $${periodRevenueUSD.toFixed(2)} USD`);

  return { period, projects, summary };
}