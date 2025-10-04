// routes/complete-data.ts - Single Source of Truth integration
import type { Request, Response } from 'express';
import { resolveTimeFilter } from '../services/time';
import { computeProjectPeriodMetrics } from '../domain/metrics';
import { parseTimeLegacyOrNew } from '../utils/period';
import { getProjectSummary } from '../domain/metrics/period_ledger';
import { canonicalizeKey } from '../domain/shared/strings';
import { db } from '../db';
import { activeProjects, quotations, clients } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export async function completeDataHandler(req: Request, res: Response) {
  try {
    const projectId = String(req.params.id ?? req.query.projectId ?? '');
    const timeFilterQuery = String(req.query.timeFilter ?? '');
    const periodQuery = String(req.query.period ?? '');
    
    // 🎯 RESTORE LEGACY BASIS CONTRACT: Accept ECON/EXEC (and lowercase aliases)
    const basisQuery = String(req.query.basis ?? 'ECON').toUpperCase();
    let basis: 'ECON' | 'EXEC' | 'usd' | 'native';
    let basisNormalized: 'usd' | 'native';
    
    if (basisQuery === 'EXEC' || basisQuery === 'NATIVE') {
      basis = 'EXEC';
      basisNormalized = 'native';
    } else {
      basis = 'ECON';
      basisNormalized = 'usd';
    }
    
    // 🎯 SoT INTEGRATION: Parse both period=YYYY-MM and legacy timeFilter
    let period: string;
    let usingSoT = false;
    
    if (periodQuery && /^\d{4}-\d{2}$/.test(periodQuery)) {
      // NEW FORMAT: period=YYYY-MM
      period = periodQuery;
      usingSoT = true;
      console.log(`🎯 COMPLETE-DATA SoT MODE: Project ${projectId}, period=${period}, basis=${basis} (${basisNormalized})`);
    } else if (timeFilterQuery) {
      // LEGACY FORMAT: timeFilter=august_2025
      const parsed = parseTimeLegacyOrNew({ timeFilter: timeFilterQuery });
      period = parsed.period;
      console.log(`📅 COMPLETE-DATA LEGACY MODE: Project ${projectId}, timeFilter=${timeFilterQuery} → period=${period}, basis=${basis} (${basisNormalized})`);
    } else {
      return res.status(400).json({ error: 'Either period (YYYY-MM) or timeFilter is required' });
    }
    
    // Get project data
    const projectData = await db.query.activeProjects.findFirst({
      where: eq(activeProjects.id, parseInt(projectId))
    });

    if (!projectData) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get quotation data separately
    const quotationData = projectData.quotationId 
      ? await db.query.quotations.findFirst({
          where: eq(quotations.id, projectData.quotationId)
        })
      : null;
    
    // 🚀 SoT INTEGRATION: Get metrics from SoT if using period format
    let sotSummary = null;
    if (usingSoT && quotationData?.projectName) {
      try {
        // Get client data to generate projectKey
        const clientData = await db.query.clients.findFirst({
          where: eq(clients.id, projectData.clientId)
        });
        
        const clientName = clientData?.name || '';
        const projectName = quotationData.projectName || '';
        const projectKey = canonicalizeKey(`${clientName}|${projectName}`);
        
        console.log(`🎯 SoT FETCH: Calling getProjectSummary('${projectKey}', '${period}')`);
        sotSummary = await getProjectSummary(projectKey, period);
        console.log(`🎯 SoT SUMMARY for ${projectKey}:`, JSON.stringify(sotSummary, null, 2));
      } catch (error) {
        console.warn(`⚠️ SoT fallback: Could not get SoT summary, using legacy:`, error);
      }
    }
    
    const pm = await computeProjectPeriodMetrics(parseInt(projectId), timeFilterQuery || period, basis === 'EXEC' ? 'EXEC' : 'ECON');

    console.log(`🔍 COMPLETE-DATA METRICS: summary exists: ${!!pm.summary}, teamCostUSD: ${pm.summary?.teamCostUSD}`);

    // --- ADAPTER: PeriodMetrics -> CompleteDataResponse ---
    // 🚀 SoT OVERRIDE: If we have SoT summary, use those KPIs instead
    const revenueUSD = sotSummary?.revenueUSD ?? pm.summary?.revenueUSD ?? 0;
    const teamCostUSD = sotSummary?.costUSD ?? pm.summary?.teamCostUSD ?? 0;
    const markupUSD = revenueUSD - teamCostUSD;
    
    const summary = {
      period: period,        // 'YYYY-MM'
      basis,
      activeMembers: (pm.teamBreakdown ?? []).filter(p => (p.actualHours ?? 0) > 0).length,
      totalHours: pm.summary?.totalHours,              // ΣL
      efficiencyPct: pm.summary?.efficiencyPct,       // ΣL/ΣK*100 (K=0→70)
      teamCostUSD,           // Σ actualCost (from SoT if available)
      revenueUSD,            // From SoT if available
      markupUSD,             // revenue - teamCost
      emptyStates: pm.summary?.emptyStates ?? { costos: false, ingresos: false, horas: false, objetivos: false },
      hasData: pm.summary?.hasData ?? { costos: true, ingresos: true },
      // 🎯 SoT FIELDS
      ...(sotSummary && {
        revenueDisplay: basisNormalized === 'native' ? sotSummary.revenueDisplay : undefined,
        costDisplay: basisNormalized === 'native' ? sotSummary.costDisplay : undefined,
        currencyNative: sotSummary.currencyNative,
        markup: sotSummary.markup,
        margin: sotSummary.margin,
        flags: sotSummary.flags
      })
    };

    const teamBreakdown = (pm.teamBreakdown ?? []).map(p => ({
      personnelId: p.personnelId ?? p.name,
      name: p.name,
      role: p.role,
      estimatedHours: p.targetHours ?? 0,
      actualHours: p.actualHours ?? 0,
      actualCost: p.actualCost ?? 0,
      budgetedCost: p.budgetCost ?? 0,
      rate: null,
      efficiency: p.efficiency ?? 70
    }));

    // Compat opcional (si el front viejo lo pide)
    const legacy = {
      estimatedHours: (pm.teamBreakdown ?? []).reduce((sum, p) => sum + (p.targetHours ?? 0), 0),
      workedHours: pm.summary?.totalHours ?? null,
      totalCost: pm.summary?.teamCostUSD ?? null,
      markup: pm.summary?.markupUSD ?? null
    };

    console.log(`✅ COMPLETE-DATA RESPONSE: summary.teamCostUSD=${summary.teamCostUSD}, teamBreakdown.length=${teamBreakdown.length}`);
    console.log(`🔍 DEBUG MAPPING: summary=${JSON.stringify(summary, null, 2)}`);

    const actualsData = {
      totalWorkedCost: summary.teamCostUSD,
      totalWorkedRevenue: summary.revenueUSD, 
      totalWorkedHours: summary.totalHours,
      totalEntries: teamBreakdown.length,
      teamBreakdown
    };
    console.log(`🔍 DEBUG ACTUALS: actuals=${JSON.stringify(actualsData, null, 2)}`);

    // Calculate correct markup ratio (use SoT if available)
    const correctMarkupRatio = sotSummary?.markup ?? (summary.teamCostUSD > 0 ? (summary.revenueUSD / summary.teamCostUSD) : 0);
    const correctMarginRatio = sotSummary?.margin ?? (summary.revenueUSD > 0 ? ((summary.revenueUSD - summary.teamCostUSD) / summary.revenueUSD) : 0);
    console.log(`🔍 MARKUP CALCULATION: ${summary.revenueUSD} / ${summary.teamCostUSD} = ${correctMarkupRatio}${sotSummary ? ' (from SoT)' : ''}`);

    const response = {
      // 🎯 FRONTEND COMPATIBILITY: Map to expected structure
      project: {
        id: projectData.id,
        clientId: projectData.clientId,
        status: projectData.status
      },
      quotation: quotationData ? {
        id: quotationData.id,
        projectName: quotationData.projectName,
        baseCost: quotationData.baseCost,
        estimatedHours: quotationData.estimatedHours,
        totalAmount: quotationData.totalAmount,
        markup: quotationData.markup
      } : null,
      actuals: actualsData,
      metrics: {
        efficiency: summary.efficiencyPct,
        markup: correctMarkupRatio,
        margin: correctMarginRatio,
        budgetUtilization: 0,
        hoursDeviation: 0,
        costDeviation: 0
      },
      summary,
      teamBreakdown,
      ingresos: pm.ingresos ?? [],
      costos: pm.costos ?? [],
      // Legacy compatibility (removed spread to prevent overwriting metrics)
      estimatedHours: legacy.estimatedHours,
      workedHours: legacy.workedHours,
      totalCost: legacy.totalCost,
      totalRealRevenue: summary.revenueUSD
    };
    
    console.log(`🔍 FINAL RESPONSE MARKUP: ${response.metrics.markup}`);
    console.log(`🔍 RESPONSE includes project: ${!!response.project}, quotation: ${!!response.quotation}`);
    return res.json(response);
  } catch (e: any) {
    console.error('❌ COMPLETE-DATA ERROR:', e.message);
    return res.status(500).json({ error: 'complete-data failed', detail: e?.message });
  }
}