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
    // Preservar moneda original: usar ARS si hay ARS significativo, sino USD
    // ARS significativo = ARS > USD * 10 (detectar que es la moneda principal)
    const sumUSD = list.reduce((a, r) => a + (r.amountUSD || 0), 0);
    const sumARS = list.reduce((a, r) => a + (r.amountARS || 0), 0);

    console.log(`🔍 CURRENCY LOGIC for ${clientName}/${projectName}:`);
    console.log(`   ARS: ${sumARS.toLocaleString()} | USD: ${sumUSD.toLocaleString()}`);
    console.log(`   ARS > USD*10? ${sumARS} > ${sumUSD * 10} = ${sumARS > sumUSD * 10}`);

    const revenueDisplay =
      sumARS > sumUSD * 10 ? { amount: sumARS, currency: 'ARS' as const } :
      sumUSD > 0 ? { amount: sumUSD, currency: 'USD' as const } :
      sumARS > 0 ? { amount: sumARS, currency: 'ARS' as const } :
      { amount: 0, currency: 'USD' as const };

    console.log(`   → Display: ${revenueDisplay.currency} ${revenueDisplay.amount.toLocaleString()}`);

    // 6) NORMALIZACIÓN A USD PARA KPIs (regla estricta por registro)
    // IMPORTANTE: Usar misma lógica que currency display para consistencia
    const revenueUSDNormalized = list.reduce((acc, r) => {
      if (r.amountARS > r.amountUSD * 10) {
        // ARS es significativo → usar ARS/fx
        return acc + (r.amountARS / fx);
      } else if (r.amountUSD > 0) {
        // USD es significativo → usar USD directo
        return acc + r.amountUSD;
      } else if (r.amountARS > 0) {
        // Solo ARS disponible → usar ARS/fx
        return acc + (r.amountARS / fx);
      }
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
      records: list.flatMap(r => {
        const records: Array<{currency: 'USD' | 'ARS', amount: number}> = [];
        if (r.amountUSD > 0) records.push({ currency: 'USD', amount: r.amountUSD });
        if (r.amountARS > 0) records.push({ currency: 'ARS', amount: r.amountARS });
        return records.length > 0 ? records : [{ currency: 'USD', amount: 0 }];
      }),
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