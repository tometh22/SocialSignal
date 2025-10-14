// routes/complete-data.ts - Single Source of Truth integration
import type { Request, Response } from 'express';
import { resolveTimeFilter } from '../services/time';
import { computeProjectPeriodMetrics } from '../domain/metrics';
import { parseTimeLegacyOrNew } from '../utils/period';
import { getProjectSummary } from '../domain/metrics/period_ledger';
import { canonicalizeKey } from '../domain/shared/strings';
import { db } from '../db';
import { activeProjects, quotations, clients } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { ActiveProjectsAggregator } from '../domain/projectsActive';
import { storage } from '../storage';

// Period reconciler overrides for August 2025
interface CostOverride {
  clientKey: string;
  projectKey: string;
  period: string;
  nativeAmount: number;
  nativeCurrency: 'USD' | 'ARS';
}

const COST_OVERRIDES_2025_08: CostOverride[] = [
  { clientKey: 'warner', projectKey: 'fee-marketing', period: '2025-08', nativeAmount: 7005.20, nativeCurrency: 'USD' },
  { clientKey: 'kimberly-clark', projectKey: 'fee-huggies', period: '2025-08', nativeAmount: 2436.09, nativeCurrency: 'USD' },
  { clientKey: 'play-digital-sa-modo', projectKey: 'fee-mensual', period: '2025-08', nativeAmount: 497550, nativeCurrency: 'ARS' },
  { clientKey: 'coelsa', projectKey: 'fee-mensual', period: '2025-08', nativeAmount: 553002, nativeCurrency: 'ARS' }
];

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
}

function applyCostReconciler(summary: any, projectKey: string, period: string, clientName: string, projectName: string, fxRate: number = 1345): any {
  if (period !== '2025-08' || !summary) return summary;
  
  const clientKey = slugify(clientName);
  const projKey = slugify(projectName);
  const key = `${clientKey}|${projKey}`;
  
  const override = COST_OVERRIDES_2025_08.find(o => `${o.clientKey}|${o.projectKey}` === key);
  
  if (override) {
    const costUSD = override.nativeCurrency === 'USD' ? override.nativeAmount : override.nativeAmount / fxRate;
    const costDisplay = override.nativeAmount;
    
    console.log(`🔧 COMPLETE-DATA RECONCILER: ${clientName} | ${projectName} → ${override.nativeCurrency} ${override.nativeAmount} (was USD ${summary.costUSD})`);
    
    return {
      ...summary,
      costUSD,
      costDisplay,
      profitUSD: summary.revenueUSD - costUSD,
      markup: costUSD > 0 ? summary.revenueUSD / costUSD : null,
      margin: summary.revenueUSD > 0 ? (summary.revenueUSD - costUSD) / summary.revenueUSD : 0,
      currencyNative: override.nativeCurrency,
      flags: [...(summary.flags || []), 'RECONCILER_OVERRIDE']
    };
  }
  
  return summary;
}

/**
 * Helper: Resolve projectKey to activeProject ID
 * ProjectKey format: "clientname|projectname" (canonicalized)
 */
async function resolveProjectKey(projectKey: string): Promise<number | null> {
  // Parse projectKey
  const parts = projectKey.split('|');
  if (parts.length < 2) return null;
  
  const [clientPart, ...projectParts] = parts;
  const projectPart = projectParts.join('|'); // In case project name contains '|'
  
  // Canonicalize for matching
  const clientCanon = canonicalizeKey(clientPart);
  const projectCanon = canonicalizeKey(projectPart);
  
  console.log(`🔍 RESOLVE KEY: "${projectKey}" → client:"${clientCanon}" project:"${projectCanon}"`);
  
  // Find client by canonicalized name
  const allClients = await db.query.clients.findMany();
  const matchingClient = allClients.find(c => 
    canonicalizeKey(c.name || '') === clientCanon
  );
  
  if (!matchingClient) {
    console.log(`❌ RESOLVE KEY: No client found for "${clientCanon}"`);
    return null;
  }
  
  console.log(`✅ RESOLVE KEY: Found client #${matchingClient.id} "${matchingClient.name}"`);
  
  // Find quotation by clientId and canonicalized projectName
  const allQuotations = await db.query.quotations.findMany({
    where: eq(quotations.clientId, matchingClient.id)
  });
  
  const matchingQuotation = allQuotations.find(q => 
    canonicalizeKey(q.projectName || '') === projectCanon
  );
  
  if (!matchingQuotation) {
    console.log(`❌ RESOLVE KEY: No quotation found for client #${matchingClient.id} project "${projectCanon}"`);
    return null;
  }
  
  console.log(`✅ RESOLVE KEY: Found quotation #${matchingQuotation.id} "${matchingQuotation.projectName}"`);
  
  // Find activeProject by quotationId
  const activeProject = await db.query.activeProjects.findFirst({
    where: eq(activeProjects.quotationId, matchingQuotation.id)
  });
  
  if (!activeProject) {
    console.log(`❌ RESOLVE KEY: No active project found for quotation #${matchingQuotation.id}`);
    return null;
  }
  
  console.log(`✅ RESOLVE KEY: Resolved "${projectKey}" → activeProject #${activeProject.id}`);
  return activeProject.id;
}

export async function completeDataHandler(req: Request, res: Response) {
  try {
    const projectId = String(req.params.id ?? req.query.projectId ?? '');
    const timeFilterQuery = String(req.query.timeFilter ?? '');
    const periodQuery = String(req.query.period ?? '');
    
    // 🎯 NEW: 3-View System Support (original | operativa | usd)
    const viewQuery = String(req.query.view ?? '').toLowerCase() as 'original' | 'operativa' | 'usd' | '';
    const view: 'original' | 'operativa' | 'usd' = viewQuery && ['original', 'operativa', 'usd'].includes(viewQuery) 
      ? viewQuery as any
      : 'operativa'; // Default to operativa view
    
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
      console.log(`🎯 COMPLETE-DATA SoT MODE: Project ${projectId}, period=${period}, view=${view}, basis=${basis} (${basisNormalized})`);
    } else if (timeFilterQuery) {
      // LEGACY FORMAT: timeFilter=august_2025
      const parsed = parseTimeLegacyOrNew({ timeFilter: timeFilterQuery });
      period = parsed.period;
      console.log(`📅 COMPLETE-DATA LEGACY MODE: Project ${projectId}, timeFilter=${timeFilterQuery} → period=${period}, view=${view}, basis=${basis} (${basisNormalized})`);
    } else {
      return res.status(400).json({ error: 'Either period (YYYY-MM) or timeFilter is required' });
    }
    
    // Get project data - support both numeric ID and projectKey
    let resolvedProjectId: number;
    const numericId = parseInt(projectId);
    
    if (!isNaN(numericId)) {
      // Numeric ID provided - use directly
      resolvedProjectId = numericId;
      console.log(`🔢 COMPLETE-DATA: Using numeric ID ${resolvedProjectId}`);
    } else {
      // ProjectKey provided - resolve to numeric ID
      console.log(`🔑 COMPLETE-DATA: Resolving projectKey "${projectId}"`);
      const resolved = await resolveProjectKey(projectId);
      
      if (!resolved) {
        return res.status(404).json({ 
          error: 'Project not found',
          message: `Could not resolve projectKey "${projectId}" to an active project`,
          hint: 'ProjectKey format should be "clientname|projectname" (case-insensitive)'
        });
      }
      
      resolvedProjectId = resolved;
    }
    
    const projectData = await db.query.activeProjects.findFirst({
      where: eq(activeProjects.id, resolvedProjectId)
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
    
    // 🎯 NEW: 3-VIEW SYSTEM - ALWAYS try to use view-aggregator for ALL views (including operativa)
    try {
      const { getProjectPeriodView } = await import('../domain/view-aggregator');
      const viewData = await getProjectPeriodView(resolvedProjectId, period, view);
      
      if (viewData) {
        console.log(`🎨 VIEW-AGGREGATOR: Using ${view} view for project ${resolvedProjectId}, period ${period}`);
        
        // Return view-based response with consistent structure
        return res.json({
          view: view, // CRITICAL: Include view field for frontend
          project: {
            id: projectData.id,
            clientId: projectData.clientId,
            status: projectData.status
          },
          quotation: quotationData ? {
            id: quotationData.id,
            projectName: quotationData.projectName,
            baseCost: quotationData.baseCost,
            totalAmount: viewData.cotizacion || quotationData.totalAmount,
            totalAmountNative: viewData.cotizacion || quotationData.totalAmount,
            estimatedHours: viewData.estimatedHours || -1
          } : null,
          actuals: {
            totalWorkedHours: viewData.totalWorkedHours,
            totalAsanaHours: viewData.totalAsanaHours,  // 🎯 3-hours architecture
            totalBillingHours: viewData.totalBillingHours,  // 🎯 3-hours architecture
            totalWorkedCost: viewData.costDisplay, // Display value
            totalEntries: 0,
            teamBreakdown: viewData.teamBreakdown
          },
          metrics: {
            efficiency: 0,
            markup: viewData.markup || 0,
            margin: viewData.margin || 0,
            budgetUtilization: viewData.budgetUtilization || 0,
            hoursDeviation: 0,
            costDeviation: 0
          },
          summary: {
            teamCostUSD: viewData.costDisplay, // TODO: normalize to USD if needed
            revenueUSD: viewData.revenueDisplay,
            markupUSD: viewData.markup || 0,
            costDisplay: viewData.costDisplay, // CRITICAL: Include for frontend
            revenueDisplay: viewData.revenueDisplay, // CRITICAL: Include for frontend
            currencyNative: viewData.currencyNative, // CRITICAL: Include for frontend
            markup: viewData.markup,
            margin: viewData.margin,
            flags: [...viewData.flags, `VIEW_${view.toUpperCase()}`]
          },
          estimatedHours: viewData.estimatedHours,
          workedHours: viewData.totalWorkedHours,
          totalCost: viewData.costDisplay,
          totalRealRevenue: viewData.revenueDisplay
        });
      } else {
        console.warn(`⚠️ VIEW-AGGREGATOR: No data in project_aggregates for ${view} view (project ${resolvedProjectId}, period ${period}), falling back to legacy mode`);
        // Flag will be added to response below to indicate fallback mode
      }
    } catch (err: any) {
      console.error(`❌ VIEW-AGGREGATOR ERROR: ${err.message}, falling back to legacy mode`);
      // Continue with legacy mode
    }
    
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
        let rawSotSummary = await getProjectSummary(projectKey, period);
        console.log(`🎯 RAW SoT SUMMARY for ${projectKey}:`, JSON.stringify(rawSotSummary, null, 2));
        
        // 🔧 Apply reconciler for August 2025
        sotSummary = applyCostReconciler(rawSotSummary, projectKey, period, clientName, projectName);
        console.log(`🎯 RECONCILED SoT SUMMARY for ${projectKey}:`, JSON.stringify(sotSummary, null, 2));
        
        // 🛡️ AGGREGATOR FALLBACK: If SoT tables are empty, use Excel directly
        if (!sotSummary) {
          console.warn(`⚠️ SoT FALLBACK: Tables empty for ${projectKey} ${period}, using ActiveProjectsAggregator`);
          const aggregator = new ActiveProjectsAggregator(storage);
          
          // Convert period to timeFilter format (YYYY-MM → monthname_yyyy)
          const [year, month] = period.split('-');
          const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
          const timeFilter = `${monthNames[parseInt(month) - 1]}_${year}`;
          
          const aggregatorResponse = await aggregator.getActiveProjectsUnified(timeFilter, false);
          const project = aggregatorResponse?.projects?.find((p: any) => p.id === resolvedProjectId);
          
          if (project?.metrics) {
            const displayCurrency = project.metrics.revenueDisplay?.currency || project.metrics.costDisplay?.currency || 'USD';
            sotSummary = {
              revenueUSD: project.metrics.revenueUSD || 0,
              costUSD: project.metrics.costUSD || 0,
              profitUSD: project.metrics.profitUSD || 0,
              markup: project.metrics.markupRatio || null,
              margin: project.metrics.marginFrac || 0,
              revenueDisplay: project.metrics.revenueDisplay?.amount || 0,
              costDisplay: project.metrics.costDisplay?.amount || 0,
              currencyNative: displayCurrency,
              flags: ['FALLBACK_AGGREGATOR']
            };
            console.log(`✅ SoT FALLBACK SUCCESS: Got metrics from aggregator`, sotSummary);
          }
        }
      } catch (error) {
        console.warn(`⚠️ SoT error: Could not get SoT summary:`, error);
      }
    }
    
    // Use numeric ID for legacy computeProjectPeriodMetrics
    const pm = await computeProjectPeriodMetrics(projectData.id, timeFilterQuery || period, basis === 'EXEC' ? 'EXEC' : 'ECON');

    console.log(`🔍 COMPLETE-DATA METRICS: summary exists: ${!!pm.summary}, teamCostUSD: ${pm.summary?.teamCostUSD}`);

    // --- ADAPTER: PeriodMetrics -> CompleteDataResponse ---
    // 🚀 SoT OVERRIDE: If we have SoT summary, use those KPIs instead
    const revenueUSD = sotSummary?.revenueUSD ?? pm.summary?.revenueUSD ?? 0;
    const teamCostUSD = sotSummary?.costUSD ?? pm.summary?.teamCostUSD ?? 0;
    const markupUSD = revenueUSD - teamCostUSD;
    
    let summary = {
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
        revenueDisplay: sotSummary.revenueDisplay,
        costDisplay: sotSummary.costDisplay,
        currencyNative: sotSummary.currencyNative,
        markup: sotSummary.markup,
        margin: sotSummary.margin,
        flags: sotSummary.flags
      })
    };
    
    // 🔧 LEGACY RECONCILER: Apply cost overrides even for legacy timeFilter mode
    if (!sotSummary && quotationData?.projectName) {
      const clientData = await db.query.clients.findFirst({
        where: eq(clients.id, projectData.clientId)
      });
      const clientName = clientData?.name || '';
      const projectName = quotationData.projectName || '';
      const projectKey = canonicalizeKey(`${clientName}|${projectName}`);
      
      // Apply reconciler with the base summary (using teamCostUSD as costUSD)
      const baseSummary = {
        costUSD: summary.teamCostUSD,
        revenueUSD: summary.revenueUSD,
        profitUSD: summary.markupUSD,
        markup: summary.teamCostUSD > 0 ? summary.revenueUSD / summary.teamCostUSD : null,
        margin: summary.revenueUSD > 0 ? (summary.revenueUSD - summary.teamCostUSD) / summary.revenueUSD : 0
      };
      
      const reconciledSummary = applyCostReconciler(baseSummary, projectKey, period, clientName, projectName);
      
      if (reconciledSummary && reconciledSummary.costDisplay !== undefined) {
        console.log(`🔧 LEGACY RECONCILER APPLIED: ${clientName} | ${projectName} → ${reconciledSummary.currencyNative} ${reconciledSummary.costDisplay}`);
        summary = {
          ...summary,
          costDisplay: reconciledSummary.costDisplay,
          currencyNative: reconciledSummary.currencyNative,
          revenueDisplay: reconciledSummary.currencyNative === 'ARS' ? reconciledSummary.revenueUSD * 1345 : reconciledSummary.revenueUSD,
          markup: reconciledSummary.markup,
          margin: reconciledSummary.margin,
          teamCostUSD: reconciledSummary.costUSD,
          flags: reconciledSummary.flags || []
        };
      }
    }

    // 🔧 HOTFIX: Hydrate member with on-the-fly normalization for legacy data
    const normHours = (x?: number, context?: string): number => {
      if (!Number.isFinite(x as number)) return 0;
      const val = x as number;
      if (val > 500) {
        console.warn(`⚠️ ANTI_×100 APPLIED [${context}]: ${val} → ${val/100} (threshold: 500h)`);
        return val / 100;
      }
      return val;
    };
    
    const fxMes = sotSummary?.currencyNative === 'ARS' && sotSummary?.revenueUSD && sotSummary?.revenueDisplay
      ? sotSummary.revenueDisplay / sotSummary.revenueUSD
      : 1345; // Default fallback
    
    const hydrateMember = (m: any) => {
      // Helper: parsea a número válido o retorna null si inválido
      const safeNum = (val: any): number | null => {
        const n = Number(val);
        return Number.isFinite(n) ? n : null;
      };
      
      const memberName = m.name || m.personnelId || 'Unknown';
      const targetHours = safeNum(m.targetHours ?? m.estimatedHours) ?? 0;
      
      // hoursAsana con fallbacks múltiples, SIEMPRE normalizar
      // Usar hoursBilling como proxy si no hay hoursAsana directo (los aggregates no guardan hoursAsana separado)
      const hoursAsanaRaw = safeNum(m.hoursAsana) ?? safeNum(m.horasRealesAsana) ?? safeNum(m.hours ?? m.actualHours) ?? safeNum(m.hoursBilling) ?? 0;
      const hoursAsana = normHours(hoursAsanaRaw, `${memberName}.hoursAsana`);
      
      // hoursBilling: horasParaFacturacion → hoursAsana → targetHours
      const billingRaw = safeNum(m.hoursBilling ?? m.horasParaFacturacion);
      const hoursBilling = (() => {
        if (billingRaw && billingRaw > 0) return normHours(billingRaw, `${memberName}.hoursBilling`);
        if (hoursAsana > 0) return hoursAsana; // Ya normalizado arriba
        return targetHours; // Último fallback
      })();
      
      // 🎯 Cost calculation
      const rateARS = Number(m.hourlyRateARS ?? m.rateARS ?? m.rate ?? 0);
      const costARS = Number(m.costARS ?? (hoursBilling * rateARS || 0));
      const costUSD = Number(m.costUSD ?? (fxMes ? costARS / fxMes : 0));
      
      return {
        personnelId: m.personnelId ?? m.name,
        name: m.name,
        role: m.role,
        roleName: m.roleName ?? m.role ?? 'N/A',
        // 3-hours architecture
        targetHours,
        hoursAsana,
        hoursBilling,
        hours: hoursAsana, // Legacy compatibility
        // Costs
        costARS,
        costUSD,
        hourlyRateARS: rateARS,
        // Legacy fields
        estimatedHours: targetHours,
        actualHours: hoursAsana,
        actualCost: costUSD,
        budgetedCost: m.budgetCost ?? 0,
        rate: rateARS > 0 ? rateARS : null,
        efficiency: m.efficiency ?? 70
      };
    };
    
    const teamBreakdown = (pm.teamBreakdown ?? []).map(hydrateMember);

    // Compat opcional (si el front viejo lo pide)
    const legacy = {
      estimatedHours: (pm.teamBreakdown ?? []).reduce((sum, p) => sum + (p.targetHours ?? 0), 0),
      workedHours: pm.summary?.totalHours ?? null,
      totalCost: pm.summary?.teamCostUSD ?? null,
      markup: pm.summary?.markupUSD ?? null
    };

    // 🎯 Calculate aggregates from hydrated team breakdown
    const totalAsanaHours = teamBreakdown.reduce((sum, m) => sum + (m.hoursAsana || 0), 0);
    const totalBillingHours = teamBreakdown.reduce((sum, m) => sum + (m.hoursBilling || 0), 0);
    const totalTargetHours = teamBreakdown.reduce((sum, m) => sum + (m.targetHours || 0), 0);
    
    console.log(`✅ COMPLETE-DATA RESPONSE: summary.teamCostUSD=${summary.teamCostUSD}, teamBreakdown.length=${teamBreakdown.length}`);
    console.log(`🎯 3-HOURS AGGREGATES: targetHours=${totalTargetHours}, asanaHours=${totalAsanaHours}, billingHours=${totalBillingHours}`);
    console.log(`🔍 DEBUG MAPPING: summary=${JSON.stringify(summary, null, 2)}`);

    const actualsData = {
      totalWorkedCost: summary.teamCostUSD,
      totalWorkedRevenue: summary.revenueUSD, 
      totalWorkedHours: summary.totalHours,
      totalAsanaHours,  // 🎯 NEW: Normalized Asana hours
      totalBillingHours,  // 🎯 NEW: Billing hours with fallback
      totalEntries: teamBreakdown.length,
      teamBreakdown
    };
    console.log(`🔍 DEBUG ACTUALS: actuals=${JSON.stringify(actualsData, null, 2)}`);

    // Calculate correct markup ratio (use SoT if available)
    const correctMarkupRatio = sotSummary?.markup ?? (summary.teamCostUSD > 0 ? (summary.revenueUSD / summary.teamCostUSD) : 0);
    const correctMarginRatio = sotSummary?.margin ?? (summary.revenueUSD > 0 ? ((summary.revenueUSD - summary.teamCostUSD) / summary.revenueUSD) : 0);
    console.log(`🔍 MARKUP CALCULATION: ${summary.revenueUSD} / ${summary.teamCostUSD} = ${correctMarkupRatio}${sotSummary ? ' (from SoT)' : ''}`);

    // 🔒 Calculate totalAmountNative for quotation based on currencyNative
    const currencyNative = summary.currencyNative || 'ARS';
    const fxRate = 1345; // TODO: Get from exchange_rates table for the period
    
    let totalAmountNative = quotationData?.totalAmount || 0;
    if (quotationData) {
      // If quotation has its own currency setting, respect it
      if (quotationData.quotationCurrency === 'USD' && currencyNative === 'ARS') {
        totalAmountNative = quotationData.totalAmount * fxRate;
      } else if (quotationData.quotationCurrency === 'ARS' && currencyNative === 'USD') {
        totalAmountNative = quotationData.totalAmount / fxRate;
      } else {
        // Same currency or quotationCurrency matches currencyNative
        totalAmountNative = quotationData.totalAmount;
      }
    }
    
    // Calculate budgetUtilization using native currency values
    const budgetUtilization = totalAmountNative > 0 && summary.costDisplay 
      ? summary.costDisplay / totalAmountNative 
      : 0;

    // 🚨 Add LEGACY_FALLBACK flag if view-aggregator was not used
    const legacyFlags = [...(summary.flags || []), 'LEGACY_FALLBACK'];
    
    const response = {
      // 🎯 3-VIEW SYSTEM: Include view field for frontend
      view: view, // CRITICAL: Frontend needs to know which view is being used
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
        totalAmount: quotationData.totalAmount,
        totalAmountNative, // 🔒 Native currency amount for consistent calculations
        estimatedHours: legacy.estimatedHours || -1, // From team breakdown
        markupAmount: quotationData.markupAmount,
        marginFactor: quotationData.marginFactor
      } : null,
      actuals: actualsData,
      metrics: {
        efficiency: summary.efficiencyPct,
        markup: correctMarkupRatio,
        margin: correctMarginRatio,
        budgetUtilization,
        hoursDeviation: 0,
        costDeviation: 0
      },
      summary: {
        ...summary,
        flags: legacyFlags // Add LEGACY_FALLBACK flag
      },
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