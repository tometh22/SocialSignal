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


/**
 * Helper: Calculate previous period from YYYY-MM format
 * Returns null for 'all' (lifetime mode) or invalid formats
 */
function getPreviousPeriod(currentPeriod: string): string | null {
  // Skip calculation for lifetime mode
  if (currentPeriod === 'all') {
    return null;
  }
  
  // Validate YYYY-MM format
  const periodRegex = /^(\d{4})-(\d{2})$/;
  const match = currentPeriod.match(periodRegex);
  
  if (!match) {
    console.warn(`⚠️ PREVIOUS-PERIOD: Invalid period format "${currentPeriod}", expected YYYY-MM`);
    return null;
  }
  
  const year = parseInt(match[1]);
  const month = parseInt(match[2]);
  
  // Calculate previous month with year rollback
  let prevYear = year;
  let prevMonth = month - 1;
  
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = year - 1;
  }
  
  // Format as YYYY-MM with leading zero
  const prevPeriod = `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;
  
  console.log(`📅 PREVIOUS-PERIOD: ${currentPeriod} → ${prevPeriod}`);
  return prevPeriod;
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
  console.log('🚨🚨🚨 COMPLETE-DATA HANDLER CALLED', { params: req.params, query: req.query });
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
    let lifetimeMode = false;
    
    // 🎯 ONE-SHOT LIFETIME: Detect "all periods" request
    if (timeFilterQuery === 'all' || periodQuery === 'all') {
      lifetimeMode = true;
      period = 'all';
      console.log(`🎯 COMPLETE-DATA LIFETIME MODE: Project ${projectId}, aggregating all periods, view=${view}, basis=${basis}`);
    } else if (periodQuery && /^\d{4}-\d{2}$/.test(periodQuery)) {
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
    
    // 🎯 ONE-SHOT LIFETIME AGGREGATION: Handle "all periods" case
    if (lifetimeMode) {
      console.log(`🎯 LIFETIME: Aggregating ALL periods for project ${resolvedProjectId}`);
      
      try {
        const { factRCMonth, factLaborMonth } = await import('../../shared/schema');
        const { sql } = await import('drizzle-orm');
        
        // 1. Get ALL revenue from fact_rc_month
        const [revRow] = await db.select({
          totalRevenueUSD: sql<number>`coalesce(sum(${factRCMonth.revenueUSD}), 0)`.mapWith(Number),
          totalRevenueARS: sql<number>`coalesce(sum(${factRCMonth.revenueARS}), 0)`.mapWith(Number)
        })
        .from(factRCMonth)
        .where(eq(factRCMonth.projectId, resolvedProjectId));
        
        const lifetimeRevenueUSD = revRow?.totalRevenueUSD ?? 0;
        const lifetimeRevenueARS = revRow?.totalRevenueARS ?? 0;
        
        // 2. Get ALL costs from fact_labor_month
        const [costRow] = await db.select({
          totalCostUSD: sql<number>`coalesce(sum(${factLaborMonth.costUSD}), 0)`.mapWith(Number),
          totalCostARS: sql<number>`coalesce(sum(${factLaborMonth.costARS}), 0)`.mapWith(Number),
          totalHoursAsana: sql<number>`coalesce(sum(${factLaborMonth.asanaHours}), 0)`.mapWith(Number),
          totalHoursBilling: sql<number>`coalesce(sum(${factLaborMonth.billingHours}), 0)`.mapWith(Number),
          totalHoursTarget: sql<number>`coalesce(sum(${factLaborMonth.targetHours}), 0)`.mapWith(Number)
        })
        .from(factLaborMonth)
        .where(eq(factLaborMonth.projectId, resolvedProjectId));
        
        const lifetimeCostUSD = costRow?.totalCostUSD ?? 0;
        const lifetimeCostARS = costRow?.totalCostARS ?? 0;
        const lifetimeHoursAsana = costRow?.totalHoursAsana ?? 0;
        const lifetimeHoursBilling = costRow?.totalHoursBilling ?? 0;
        const lifetimeHoursTarget = costRow?.totalHoursTarget ?? 0;
        
        // 3. Determine display currency
        const currencyNative = quotationData?.quotationCurrency || 'USD';
        const revenueDisplay = currencyNative === 'USD' ? lifetimeRevenueUSD : lifetimeRevenueARS;
        const costDisplay = currencyNative === 'USD' ? lifetimeCostUSD : lifetimeCostARS;
        const cotizacion = quotationData?.totalAmount || 0;
        
        // 4. Calculate metrics
        const markup = lifetimeCostUSD > 0 ? lifetimeRevenueUSD / lifetimeCostUSD : 0;
        const margin = lifetimeRevenueUSD > 0 ? (lifetimeRevenueUSD - lifetimeCostUSD) / lifetimeRevenueUSD : 0;
        const budgetUtilization = cotizacion > 0 ? costDisplay / cotizacion : 0;
        
        console.log(`✅ LIFETIME AGGREGATION: Project ${resolvedProjectId}
          Revenue: ${currencyNative} ${revenueDisplay} (USD ${lifetimeRevenueUSD})
          Cost: ${currencyNative} ${costDisplay} (USD ${lifetimeCostUSD})
          Hours: Asana=${lifetimeHoursAsana}, Billing=${lifetimeHoursBilling}, Target=${lifetimeHoursTarget}
          Markup: ${markup.toFixed(2)}x, Margin: ${(margin*100).toFixed(1)}%, BU: ${(budgetUtilization*100).toFixed(1)}%`);
        
        // 5. Get team breakdown from fact_labor_month grouped by person
        const teamRecords = await db.select({
          personId: factLaborMonth.personId,
          personKey: factLaborMonth.personKey,
          roleName: factLaborMonth.roleName,
          targetHours: sql<number>`coalesce(sum(${factLaborMonth.targetHours}), 0)`.mapWith(Number),
          hoursAsana: sql<number>`coalesce(sum(${factLaborMonth.asanaHours}), 0)`.mapWith(Number),
          hoursBilling: sql<number>`coalesce(sum(${factLaborMonth.billingHours}), 0)`.mapWith(Number),
          costARS: sql<number>`coalesce(sum(${factLaborMonth.costARS}), 0)`.mapWith(Number),
          costUSD: sql<number>`coalesce(sum(${factLaborMonth.costUSD}), 0)`.mapWith(Number)
        })
        .from(factLaborMonth)
        .where(eq(factLaborMonth.projectId, resolvedProjectId))
        .groupBy(factLaborMonth.personId, factLaborMonth.personKey, factLaborMonth.roleName);
        
        const teamBreakdown = teamRecords.map(m => ({
          personnelId: m.personId?.toString() || m.personKey || 'unknown',
          name: m.personKey || 'Unknown',
          roleName: m.roleName || 'N/A',
          role: m.roleName || 'N/A',
          targetHours: Number(m.targetHours || 0),
          hoursAsana: Number(m.hoursAsana || 0),
          hoursBilling: Number(m.hoursBilling || 0),
          hours: Number(m.hoursAsana || 0),
          costARS: Number(m.costARS || 0),
          costUSD: Number(m.costUSD || 0),
          estimatedHours: Number(m.targetHours || 0),
          actualHours: Number(m.hoursAsana || 0),
          actualCost: Number(m.costUSD || 0)
        }));
        
        // 6. Return lifetime response
        return res.json({
          view: view,
          lifetimeMode: true,
          project: {
            id: projectData.id,
            clientId: projectData.clientId,
            status: projectData.status,
            revenueDisplay,
            costDisplay,
            cotizacion,
            currencyNative,
            budgetUtilization,
            name: quotationData?.projectName || null
          },
          quotation: quotationData ? {
            id: quotationData.id,
            projectName: quotationData.projectName,
            baseCost: quotationData.baseCost,
            totalAmount: cotizacion,
            totalAmountNative: cotizacion,
            estimatedHours: lifetimeHoursTarget || -1
          } : null,
          actuals: {
            totalWorkedHours: lifetimeHoursAsana,
            totalAsanaHours: lifetimeHoursAsana,
            totalBillingHours: lifetimeHoursBilling,
            totalWorkedCost: costDisplay,
            totalEntries: teamBreakdown.length,
            teamBreakdown
          },
          metrics: {
            efficiency: 0,
            markup,
            margin,
            budgetUtilization,
            hoursDeviation: 0,
            costDeviation: 0
          },
          summary: {
            period: 'all',
            teamCostUSD: lifetimeCostUSD,
            revenueUSD: lifetimeRevenueUSD,
            markupUSD: lifetimeRevenueUSD - lifetimeCostUSD,
            costDisplay,
            revenueDisplay,
            currencyNative,
            markup,
            margin,
            flags: ['LIFETIME_MODE', quotationData?.quotationType === 'one-time' ? 'ONE_SHOT_PROJECT' : 'RECURRING_PROJECT']
          },
          estimatedHours: lifetimeHoursTarget,
          workedHours: lifetimeHoursAsana,
          totalCost: costDisplay,
          totalRealRevenue: revenueDisplay
        });
      } catch (error) {
        console.error(`❌ LIFETIME AGGREGATION ERROR:`, error);
        return res.status(500).json({ 
          error: 'Failed to aggregate lifetime data',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // 🎯 NEW: 3-VIEW SYSTEM - ALWAYS try to use view-aggregator for ALL views (including operativa)
    try {
      const { getProjectPeriodView } = await import('../domain/view-aggregator');
      const viewData = await getProjectPeriodView(resolvedProjectId, period, view);
      
      if (viewData) {
        console.log(`🎨 VIEW-AGGREGATOR: Using ${view} view for project ${resolvedProjectId}, period ${period}`);
        
        // 🎯 Calculate labor vs RC cost mismatch flag (same as legacy mode)
        const detailedLaborCost = viewData.teamBreakdown.reduce((sum: number, m: any) => sum + ((m.costUSD || m.costARS || 0)), 0);
        const rcCost = viewData.costDisplay || 0;
        const laborMismatchPct = rcCost > 0 ? Math.abs(detailedLaborCost - rcCost) / rcCost : 0;
        const hasMismatch = laborMismatchPct > 0.10;
        const aggregatorFlags = [...viewData.flags, `VIEW_${view.toUpperCase()}`];
        
        if (hasMismatch) {
          aggregatorFlags.push('labor_vs_rc_cost_mismatch');
          console.log(`⚠️ COST MISMATCH (aggregator): Detail labor=${detailedLaborCost.toFixed(2)}, RC=${rcCost.toFixed(2)}, diff=${(laborMismatchPct*100).toFixed(1)}%`);
        }
        
        // Return view-based response with consistent structure
        return res.json({
          view: view, // CRITICAL: Include view field for frontend
          project: {
            id: projectData.id,
            clientId: projectData.clientId,
            status: projectData.status,
            // 🎯 BUG FIX: Add missing fields for frontend compatibility
            revenueDisplay: viewData.revenueDisplay,
            costDisplay: viewData.costDisplay,
            cotizacion: viewData.cotizacion, // Already corrected in view-aggregator for USD operativa
            currencyNative: viewData.currencyNative,
            budgetUtilization: viewData.budgetUtilization, // Already corrected in view-aggregator
            name: quotationData?.projectName || null
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
            totalEntries: viewData.teamBreakdown.length,
            teamBreakdown: viewData.teamBreakdown
          },
          metrics: {
            efficiency: 0,
            markup: viewData.markup || 0,
            margin: viewData.margin || 0,
            budgetUtilization: viewData.budgetUtilization || 0, // Already corrected value
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
            flags: aggregatorFlags
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
        sotSummary = await getProjectSummary(projectKey, period);
        console.log(`🎯 SoT SUMMARY for ${projectKey}:`, JSON.stringify(sotSummary, null, 2));
        
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
    
    // 🎯 FIX: Para vista operativa con clientes USD, usar revenueDisplay del mes como denominador
    // (no el totalAmount fijo de la cotización)
    let totalAmountNative = quotationData?.totalAmount || 0;
    let cotizacion = totalAmountNative; // Track the budget denominator separately
    
    if (view === 'operativa' && (quotationData?.quotationCurrency === 'USD' || currencyNative === 'USD')) {
      // For USD customers in operativa view, use monthly revenue as budget baseline
      cotizacion = summary.revenueDisplay || summary.revenueUSD || totalAmountNative;
      totalAmountNative = cotizacion;
      console.log(`💰 OPERATIVA USD: Using monthly revenue ${cotizacion} as budget baseline (not static quotation ${quotationData?.totalAmount})`);
    } else if (quotationData) {
      // Legacy logic for other views/currencies
      if (quotationData.quotationCurrency === 'USD' && currencyNative === 'ARS') {
        totalAmountNative = quotationData.totalAmount * fxRate;
        cotizacion = totalAmountNative;
      } else if (quotationData.quotationCurrency === 'ARS' && currencyNative === 'USD') {
        totalAmountNative = quotationData.totalAmount / fxRate;
        cotizacion = totalAmountNative;
      } else {
        // Same currency or quotationCurrency matches currencyNative
        totalAmountNative = quotationData.totalAmount;
        cotizacion = totalAmountNative;
      }
    }
    
    // Calculate budgetUtilization using native currency values
    const budgetUtilization = cotizacion > 0 && summary.costDisplay 
      ? summary.costDisplay / cotizacion 
      : 0;

    // 🚨 Add LEGACY_FALLBACK flag if view-aggregator was not used
    const legacyFlags = [...(summary.flags || []), 'LEGACY_FALLBACK'];
    
    // 🎯 Calculate labor vs RC cost mismatch flag
    const detailedLaborCost = teamBreakdown.reduce((sum, m) => sum + ((m.costUSD || m.costARS || 0)), 0);
    const rcCost = summary.costDisplay || summary.teamCostUSD || 0;
    const laborMismatchPct = rcCost > 0 ? Math.abs(detailedLaborCost - rcCost) / rcCost : 0;
    const hasMismatch = laborMismatchPct > 0.10;
    
    if (hasMismatch) {
      legacyFlags.push('labor_vs_rc_cost_mismatch');
      console.log(`⚠️ COST MISMATCH: Detail labor=${detailedLaborCost.toFixed(2)}, RC=${rcCost.toFixed(2)}, diff=${(laborMismatchPct*100).toFixed(1)}%`);
    }

    // 🎯 ONE-SHOT PROJECT FLAGS
    const isOneShot = quotationData?.quotationType === 'one-time';
    const hasRevenueInPeriod = (summary.revenueDisplay || summary.revenueUSD || 0) > 0;
    
    // 🎯 Find period with revenue for one-shot projects
    let periodWithRevenue: string | null = null;
    if (isOneShot) {
      legacyFlags.push('one_shot_project');
      if (!hasRevenueInPeriod) {
        legacyFlags.push('one_shot_no_revenue_this_period');
        
        // Search fact_rc_month for period with revenue > 0
        try {
          const { factRCMonth } = await import('../../shared/schema');
          const { eq, and, or, sql } = await import('drizzle-orm');
          
          const revenueRecords = await db.select({
            periodKey: factRCMonth.periodKey,
            revenueUsd: factRCMonth.revenueUSD,
            revenueArs: factRCMonth.revenueARS
          })
          .from(factRCMonth)
          .where(
            and(
              eq(factRCMonth.projectId, resolvedProjectId),
              or(
                sql`CAST(${factRCMonth.revenueUSD} AS NUMERIC) > 0`,
                sql`CAST(${factRCMonth.revenueARS} AS NUMERIC) > 0`
              )
            )
          )
          .orderBy(factRCMonth.periodKey);
          
          if (revenueRecords.length > 0) {
            periodWithRevenue = revenueRecords[0].periodKey;
            console.log(`🎯 ONE-SHOT: Found revenue in period ${periodWithRevenue} for project ${resolvedProjectId}`);
          }
        } catch (error) {
          console.error('❌ Error finding period with revenue:', error);
        }
      } else {
        // Current period has revenue
        periodWithRevenue = period;
      }
    }
    
    // 🔄 PERIOD COMPARISON: Calculate previous period metrics if applicable
    let previousPeriodData: any = null;
    const previousPeriod = getPreviousPeriod(period);
    
    console.log('🔧 PREVIOUS PERIOD GATE:', { 
      period, 
      previousPeriod, 
      lifetimeMode, 
      willExecute: previousPeriod && !lifetimeMode 
    });
    
    if (previousPeriod && !lifetimeMode) {
      console.log(`📊 DELTA: Fetching previous period ${previousPeriod} for comparison`);
      
      try {
        // Call computeProjectPeriodMetrics for previous period
        const prevPM = await computeProjectPeriodMetrics(
          projectData.id, 
          previousPeriod, 
          basis === 'EXEC' ? 'EXEC' : 'ECON'
        );
        
        // Extract key metrics for comparison
        const prevRevenueUSD = prevPM.summary?.revenueUSD ?? 0;
        const prevTeamCostUSD = prevPM.summary?.teamCostUSD ?? 0;
        const prevTotalHours = prevPM.summary?.totalHours ?? 0;
        const prevEfficiencyPct = prevPM.summary?.efficiencyPct ?? 0;
        const prevTeamMembers = (prevPM.teamBreakdown ?? []).filter(p => (p.actualHours ?? 0) > 0).length;
        
        const prevMarkup = prevTeamCostUSD > 0 ? prevRevenueUSD / prevTeamCostUSD : 0;
        const prevMargin = prevRevenueUSD > 0 ? (prevRevenueUSD - prevTeamCostUSD) / prevRevenueUSD : 0;
        
        previousPeriodData = {
          period: previousPeriod,
          hasData: prevTotalHours > 0 || prevRevenueUSD > 0 || prevTeamCostUSD > 0,
          metrics: {
            revenueUSD: prevRevenueUSD,
            teamCostUSD: prevTeamCostUSD,
            totalHours: prevTotalHours,
            efficiencyPct: prevEfficiencyPct,
            teamMembers: prevTeamMembers,
            markup: prevMarkup,
            margin: prevMargin
          }
        };
        
        console.log(`✅ DELTA: Previous period ${previousPeriod} - Revenue: $${prevRevenueUSD}, Cost: $${prevTeamCostUSD}, Hours: ${prevTotalHours}h, Members: ${prevTeamMembers}`);
      } catch (error) {
        console.warn(`⚠️ DELTA: Could not fetch previous period ${previousPeriod}:`, error);
        previousPeriodData = {
          period: previousPeriod,
          hasData: false,
          metrics: null
        };
      }
    }

    const response = {
      // 🎯 3-VIEW SYSTEM: Include view field for frontend
      view: view, // CRITICAL: Frontend needs to know which view is being used
      // 🎯 FRONTEND COMPATIBILITY: Map to expected structure
      project: {
        id: projectData.id,
        clientId: projectData.clientId,
        status: projectData.status,
        // 🎯 BUG FIX: Add missing fields for frontend compatibility
        revenueDisplay: summary.revenueDisplay || summary.revenueUSD,
        costDisplay: summary.costDisplay || summary.teamCostUSD,
        cotizacion: cotizacion, // Budget denominator (monthly revenue for USD operativa)
        currencyNative: currencyNative,
        budgetUtilization: budgetUtilization,
        name: quotationData?.projectName || null,
        // 🎯 ONE-SHOT FLAGS
        isOneShot,
        hasRevenueInPeriod,
        periodWithRevenue
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
      totalRealRevenue: summary.revenueUSD,
      // 🔄 NEW: Previous period data for delta calculations
      previousPeriod: previousPeriodData
    };
    
    console.log(`🔍 FINAL RESPONSE MARKUP: ${response.metrics.markup}`);
    console.log(`🔍 RESPONSE includes project: ${!!response.project}, quotation: ${!!response.quotation}`);
    console.log(`🔄 DELTA: Previous period included: ${!!previousPeriodData?.hasData}`);
    return res.json(response);
  } catch (e: any) {
    console.error('❌ COMPLETE-DATA ERROR:', e.message);
    return res.status(500).json({ error: 'complete-data failed', detail: e?.message });
  }
}