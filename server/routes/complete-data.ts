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
  if (currentPeriod === 'all') return null;

  const periodRegex = /^(\d{4})-(\d{2})$/;
  const match = currentPeriod.match(periodRegex);
  if (!match) return null;

  const year = parseInt(match[1]);
  const month = parseInt(match[2]);

  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth === 0) { prevMonth = 12; prevYear = year - 1; }

  return `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;
}

/**
 * Helper: Resolve projectKey to activeProject ID
 * ProjectKey format: "clientname|projectname" (canonicalized)
 */
async function resolveProjectKey(projectKey: string): Promise<number | null> {
  const parts = projectKey.split('|');
  if (parts.length < 2) return null;

  const [clientPart, ...projectParts] = parts;
  const projectPart = projectParts.join('|');
  const clientCanon = canonicalizeKey(clientPart);
  const projectCanon = canonicalizeKey(projectPart);

  const allClients = await db.query.clients.findMany();
  const matchingClient = allClients.find(c => canonicalizeKey(c.name || '') === clientCanon);
  if (!matchingClient) return null;

  const allQuotations = await db.query.quotations.findMany({
    where: eq(quotations.clientId, matchingClient.id)
  });
  const matchingQuotation = allQuotations.find(q => canonicalizeKey(q.projectName || '') === projectCanon);
  if (!matchingQuotation) return null;

  const activeProject = await db.query.activeProjects.findFirst({
    where: eq(activeProjects.quotationId, matchingQuotation.id)
  });
  return activeProject?.id ?? null;
}

/**
 * Project detail is also consumed by team members.  Hiding the Finanzas tab in
 * the client is not enough: the complete-data endpoint must not serialize
 * prices, costs, rates, revenue or margin data to a non-Operations user.
 */
function redactFinancialProjectData(payload: any, canSeeFinancials: boolean) {
  if (canSeeFinancials) return payload;

  const redactTeamMember = (member: any) => {
    const safeMember = { ...member };
    for (const key of [
      "costARS", "costUSD", "hourlyRateARS", "rate", "cost",
      "actualCost", "estimatedCost", "budgetedCost", "assignedPrice",
    ]) delete safeMember[key];
    if (safeMember.personnel) {
      safeMember.personnel = { ...safeMember.personnel };
      delete safeMember.personnel.hourlyRate;
    }
    return safeMember;
  };

  const project = payload.project
    ? { ...payload.project }
    : payload.project;
  if (project) {
    delete project.revenueDisplay;
    delete project.costDisplay;
    delete project.cotizacion;
    delete project.currencyNative;
    delete project.budgetUtilization;
  }

  const quotation = payload.quotation
    ? { ...payload.quotation }
    : payload.quotation;
  if (quotation) {
    delete quotation.baseCost;
    delete quotation.totalAmount;
    delete quotation.totalAmountNative;
    delete quotation.markupAmount;
    delete quotation.marginFactor;
    if (Array.isArray(quotation.team)) {
      quotation.team = quotation.team.map(redactTeamMember);
    }
  }

  const actuals = payload.actuals
    ? { ...payload.actuals }
    : payload.actuals;
  if (actuals) {
    delete actuals.totalWorkedCost;
    if (Array.isArray(actuals.teamBreakdown)) {
      actuals.teamBreakdown = actuals.teamBreakdown.map(redactTeamMember);
    }
  }

  const summary = payload.summary
    ? { ...payload.summary }
    : payload.summary;
  if (summary) {
    for (const key of [
      "teamCostUSD", "revenueUSD", "markupUSD", "costDisplay",
      "revenueDisplay", "currencyNative", "markup", "margin",
    ]) delete summary[key];
  }

  const previousPeriod = payload.previousPeriod
    ? { ...payload.previousPeriod }
    : payload.previousPeriod;
  if (previousPeriod?.metrics) {
    previousPeriod.metrics = { ...previousPeriod.metrics };
    for (const key of ["revenueUSD", "teamCostUSD", "markup", "margin"]) {
      delete previousPeriod.metrics[key];
    }
  }

  const metrics = payload.metrics ? { ...payload.metrics } : payload.metrics;
  if (metrics) {
    delete metrics.markup;
    delete metrics.margin;
    delete metrics.budgetUtilization;
    delete metrics.costDeviation;
  }
  const teamBreakdown = Array.isArray(payload.teamBreakdown)
    ? payload.teamBreakdown.map(redactTeamMember)
    : payload.teamBreakdown;

  return {
    ...payload,
    project,
    quotation,
    actuals,
    summary,
    metrics,
    teamBreakdown,
    previousPeriod,
    // These are legacy aliases of the same financial values.
    estimatedCost: undefined,
    totalCost: undefined,
    totalRealRevenue: undefined,
    markup: undefined,
    views: undefined,
    analysis: undefined,
    directCosts: undefined,
    costsDisplay: undefined,
    ingresos: undefined,
    costos: undefined,
  };
}

export async function completeDataHandler(req: Request, res: Response) {
  try {
    const currentUser = req.user as any;
    const canSeeFinancials = Boolean(
      currentUser?.isAdmin ||
      currentUser?.role === "admin" ||
      (Array.isArray(currentUser?.permissions) && currentUser.permissions.includes("operations")),
    );
    const projectId = String(req.params.id ?? req.query.projectId ?? '');
    const timeFilterQuery = String(req.query.timeFilter ?? '');
    const periodQuery = String(req.query.period ?? '');

    // 🎯 NEW: 3-View System Support (original | operativa | usd)
    const viewQuery = String(req.query.view ?? '').toLowerCase() as 'original' | 'operativa' | 'usd' | '';
    const view: 'original' | 'operativa' | 'usd' = viewQuery && ['original', 'operativa', 'usd'].includes(viewQuery)
      ? viewQuery as any
      : 'operativa';

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
    let range: "month" | "quarter" | "year" = "month";
    let periods: string[] = [];
    let usingSoT = false;
    let lifetimeMode = false;
    let aggregateMode = false;

    if (timeFilterQuery === 'all' || periodQuery === 'all') {
      lifetimeMode = true;
      period = 'all';
    } else if (periodQuery && /^\d{4}-\d{2}$/.test(periodQuery)) {
      period = periodQuery;
      periods = [period];
      usingSoT = true;
    } else if (timeFilterQuery) {
      const parsed = parseTimeLegacyOrNew({ timeFilter: timeFilterQuery });
      period = parsed.period;
      range = parsed.range;

      if (range === "quarter") {
        const [yearStr, monthStr] = period.split('-');
        const year = parseInt(yearStr);
        const currentMonth = parseInt(monthStr);
        const quarterNumber = Math.floor((currentMonth - 1) / 3);
        const firstMonthOfQuarter = quarterNumber * 3 + 1;
        periods = [
          `${year}-${String(firstMonthOfQuarter).padStart(2, '0')}`,
          `${year}-${String(firstMonthOfQuarter + 1).padStart(2, '0')}`,
          `${year}-${String(firstMonthOfQuarter + 2).padStart(2, '0')}`
        ];
        aggregateMode = true;
      } else {
        periods = [period];
      }
    } else {
      return res.status(400).json({ error: 'Either period (YYYY-MM) or timeFilter is required' });
    }

    // Get project data - support both numeric ID and projectKey
    let resolvedProjectId: number;
    const numericId = parseInt(projectId);

    if (!isNaN(numericId)) {
      resolvedProjectId = numericId;
    } else {
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
    if (!projectData) return res.status(404).json({ error: 'Project not found' });

    const quotationData = projectData.quotationId
      ? await db.query.quotations.findFirst({ where: eq(quotations.id, projectData.quotationId) })
      : null;

    // 🎯 ONE-SHOT LIFETIME AGGREGATION
    if (lifetimeMode) {
      try {
        const { factRCMonth, factLaborMonth } = await import('../../shared/schema');
        const { sql } = await import('drizzle-orm');

        const [revRow] = await db.select({
          totalRevenueUSD: sql<number>`coalesce(sum(${factRCMonth.revenueUSD}), 0)`.mapWith(Number),
          totalRevenueARS: sql<number>`coalesce(sum(${factRCMonth.revenueARS}), 0)`.mapWith(Number)
        }).from(factRCMonth).where(eq(factRCMonth.projectId, resolvedProjectId));

        const lifetimeRevenueUSD = revRow?.totalRevenueUSD ?? 0;
        const lifetimeRevenueARS = revRow?.totalRevenueARS ?? 0;

        const [costRow] = await db.select({
          totalCostUSD: sql<number>`coalesce(sum(${factLaborMonth.costUSD}), 0)`.mapWith(Number),
          totalCostARS: sql<number>`coalesce(sum(${factLaborMonth.costARS}), 0)`.mapWith(Number),
          totalHoursAsana: sql<number>`coalesce(sum(${factLaborMonth.asanaHours}), 0)`.mapWith(Number),
          totalHoursBilling: sql<number>`coalesce(sum(${factLaborMonth.billingHours}), 0)`.mapWith(Number),
          totalHoursTarget: sql<number>`coalesce(sum(${factLaborMonth.targetHours}), 0)`.mapWith(Number)
        }).from(factLaborMonth).where(eq(factLaborMonth.projectId, resolvedProjectId));

        const lifetimeCostUSD = costRow?.totalCostUSD ?? 0;
        const lifetimeCostARS = costRow?.totalCostARS ?? 0;
        const lifetimeHoursAsana = costRow?.totalHoursAsana ?? 0;
        const lifetimeHoursBilling = costRow?.totalHoursBilling ?? 0;
        const lifetimeHoursTarget = costRow?.totalHoursTarget ?? 0;

        const currencyNative = quotationData?.quotationCurrency || 'USD';
        const revenueDisplay = currencyNative === 'USD' ? lifetimeRevenueUSD : lifetimeRevenueARS;
        const costDisplay = currencyNative === 'USD' ? lifetimeCostUSD : lifetimeCostARS;
        const cotizacion = quotationData?.totalAmount || 0;
        const markup = lifetimeCostUSD > 0 ? lifetimeRevenueUSD / lifetimeCostUSD : 0;
        const margin = lifetimeRevenueUSD > 0 ? (lifetimeRevenueUSD - lifetimeCostUSD) / lifetimeRevenueUSD : 0;
        const budgetUtilization = cotizacion > 0 ? costDisplay / cotizacion : 0;

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

        return res.json(redactFinancialProjectData({
          view,
          lifetimeMode: true,
          project: {
            id: projectData.id,
            clientId: projectData.clientId,
            status: projectData.status,
            revenueDisplay, costDisplay, cotizacion, currencyNative, budgetUtilization,
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
          metrics: { efficiency: 0, markup, margin, budgetUtilization, hoursDeviation: 0, costDeviation: 0 },
          summary: {
            period: 'all',
            teamCostUSD: lifetimeCostUSD,
            revenueUSD: lifetimeRevenueUSD,
            markupUSD: lifetimeRevenueUSD - lifetimeCostUSD,
            costDisplay, revenueDisplay, currencyNative, markup, margin,
            flags: ['LIFETIME_MODE', quotationData?.quotationType === 'one-time' ? 'ONE_SHOT_PROJECT' : 'RECURRING_PROJECT']
          },
          estimatedHours: lifetimeHoursTarget,
          workedHours: lifetimeHoursAsana,
          totalCost: costDisplay,
          totalRealRevenue: revenueDisplay
        }, canSeeFinancials));
      } catch (error) {
        console.error(`❌ LIFETIME AGGREGATION ERROR:`, error);
        return res.status(500).json({
          error: 'Failed to aggregate lifetime data',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // 🎯 NEW: 3-VIEW SYSTEM - try view-aggregator for ALL views
    try {
      const { getProjectPeriodView } = await import('../domain/view-aggregator');
      let viewData: any = null;

      if (aggregateMode && periods.length > 1) {
        const periodDataArray = await Promise.all(
          periods.map(p => getProjectPeriodView(resolvedProjectId, p, view))
        );
        const validPeriodData = periodDataArray.filter(d => d !== null);

        if (validPeriodData.length > 0) {
          const aggregated: any = {
            costDisplay: validPeriodData.reduce((sum, d) => sum + (d.costDisplay || 0), 0),
            revenueDisplay: validPeriodData.reduce((sum, d) => sum + (d.revenueDisplay || 0), 0),
            totalWorkedHours: validPeriodData.reduce((sum, d) => sum + (d.totalWorkedHours || 0), 0),
            totalAsanaHours: validPeriodData.reduce((sum, d) => sum + (d.totalAsanaHours || 0), 0),
            totalBillingHours: validPeriodData.reduce((sum, d) => sum + (d.totalBillingHours || 0), 0),
            currencyNative: validPeriodData[0].currencyNative,
            flags: validPeriodData[0].flags || [],
            markup: 0,
            margin: 0,
            teamBreakdown: (() => {
              const teamMap = new Map();
              validPeriodData.forEach(d => {
                (d.teamBreakdown || []).forEach((member: any) => {
                  const key = member.personnelId || member.name;
                  if (teamMap.has(key)) {
                    const existing = teamMap.get(key);
                    existing.targetHours += member.targetHours || 0;
                    existing.hoursAsana += member.hoursAsana || 0;
                    existing.hoursBilling += member.hoursBilling || 0;
                    existing.costARS += member.costARS || 0;
                    existing.costUSD += member.costUSD || 0;
                  } else {
                    teamMap.set(key, {
                      ...member,
                      targetHours: member.targetHours || 0,
                      hoursAsana: member.hoursAsana || 0,
                      hoursBilling: member.hoursBilling || 0,
                      costARS: member.costARS || 0,
                      costUSD: member.costUSD || 0
                    });
                  }
                });
              });
              return Array.from(teamMap.values());
            })()
          };
          const totalCost = aggregated.costDisplay;
          const totalRevenue = aggregated.revenueDisplay;
          aggregated.markup = totalCost > 0 ? totalRevenue / totalCost : 0;
          aggregated.margin = totalRevenue > 0 ? (totalRevenue - totalCost) / totalRevenue : 0;
          viewData = aggregated;
        }
      } else {
        viewData = await getProjectPeriodView(resolvedProjectId, period, view);
      }

      if (viewData) {
        const detailedLaborCost = viewData.teamBreakdown.reduce((sum: number, m: any) => sum + ((m.costUSD || m.costARS || 0)), 0);
        const rcCost = viewData.costDisplay || 0;
        const laborMismatchPct = rcCost > 0 ? Math.abs(detailedLaborCost - rcCost) / rcCost : 0;
        const hasMismatch = laborMismatchPct > 0.10;
        const aggregatorFlags = [...viewData.flags, `VIEW_${view.toUpperCase()}`];
        if (hasMismatch) aggregatorFlags.push('labor_vs_rc_cost_mismatch');

        let previousPeriodData: any = null;
        const previousPeriod = getPreviousPeriod(period);

        if (previousPeriod && !lifetimeMode) {
          try {
            const prevViewData = await getProjectPeriodView(resolvedProjectId, previousPeriod, view);
            if (prevViewData) {
              previousPeriodData = {
                period: previousPeriod,
                hasData: (prevViewData.totalWorkedHours || 0) > 0 || (prevViewData.revenueDisplay || 0) > 0 || (prevViewData.costDisplay || 0) > 0,
                metrics: {
                  revenueUSD: prevViewData.revenueDisplay || 0,
                  teamCostUSD: prevViewData.costDisplay || 0,
                  totalHours: prevViewData.totalWorkedHours || 0,
                  efficiencyPct: 0,
                  teamMembers: prevViewData.teamBreakdown?.filter((m: any) => (m.hoursAsana || 0) > 0).length || 0,
                  markup: prevViewData.markup || 0,
                  margin: prevViewData.margin || 0
                }
              };
            } else {
              previousPeriodData = { period: previousPeriod, hasData: false, metrics: null };
            }
          } catch (error) {
            console.warn(`⚠️ DELTA: Could not fetch previous period ${previousPeriod}:`, error);
            previousPeriodData = { period: previousPeriod, hasData: false, metrics: null };
          }
        }

        return res.json(redactFinancialProjectData({
          view,
          project: {
            id: projectData.id, clientId: projectData.clientId, status: projectData.status,
            revenueDisplay: viewData.revenueDisplay, costDisplay: viewData.costDisplay,
            cotizacion: viewData.cotizacion, currencyNative: viewData.currencyNative,
            budgetUtilization: viewData.budgetUtilization,
            name: quotationData?.projectName || null
          },
          quotation: quotationData ? {
            id: quotationData.id, projectName: quotationData.projectName, baseCost: quotationData.baseCost,
            totalAmount: viewData.cotizacion || quotationData.totalAmount,
            totalAmountNative: viewData.cotizacion || quotationData.totalAmount,
            estimatedHours: viewData.estimatedHours || -1
          } : null,
          actuals: {
            totalWorkedHours: viewData.totalWorkedHours,
            totalAsanaHours: viewData.totalAsanaHours,
            totalBillingHours: viewData.totalBillingHours,
            totalWorkedCost: viewData.costDisplay,
            totalEntries: viewData.teamBreakdown.length,
            teamBreakdown: viewData.teamBreakdown
          },
          metrics: {
            efficiency: 0, markup: viewData.markup || 0, margin: viewData.margin || 0,
            budgetUtilization: viewData.budgetUtilization || 0, hoursDeviation: 0, costDeviation: 0
          },
          summary: {
            teamCostUSD: viewData.costDisplay, revenueUSD: viewData.revenueDisplay,
            markupUSD: viewData.markup || 0, costDisplay: viewData.costDisplay,
            revenueDisplay: viewData.revenueDisplay, currencyNative: viewData.currencyNative,
            markup: viewData.markup, margin: viewData.margin, flags: aggregatorFlags
          },
          estimatedHours: viewData.estimatedHours,
          workedHours: viewData.totalWorkedHours,
          totalCost: viewData.costDisplay,
          totalRealRevenue: viewData.revenueDisplay,
          previousPeriod: previousPeriodData
        }, canSeeFinancials));
      } else {
        console.warn(`⚠️ VIEW-AGGREGATOR: No data for ${view} view (project ${resolvedProjectId}, period ${period}), falling back to legacy mode`);
      }
    } catch (err: any) {
      console.error(`❌ VIEW-AGGREGATOR ERROR: ${err.message}, falling back to legacy mode`);
    }

    // 🚀 SoT INTEGRATION: Get metrics from SoT if using period format
    let sotSummary = null;
    let costsSotData = null;

    if (usingSoT && quotationData?.projectName) {
      try {
        const clientData = await db.query.clients.findFirst({ where: eq(clients.id, projectData.clientId) });
        const clientName = clientData?.name || '';
        const projectName = quotationData.projectName || '';

        const { getCostsForProject } = await import('../domain/costs');
        costsSotData = await getCostsForProject(clientName, projectName, period as any);

        const projectKey = canonicalizeKey(`${clientName}|${projectName}`);
        sotSummary = await getProjectSummary(projectKey, period);

        if (costsSotData && sotSummary) {
          sotSummary.costUSD = costsSotData.costUSDNormalized;
          sotSummary.costDisplay = costsSotData.costDisplay.amount;
          sotSummary.currencyNative = costsSotData.costDisplay.currency;
          sotSummary.profitUSD = sotSummary.revenueUSD - sotSummary.costUSD;
          sotSummary.markup = sotSummary.costUSD > 0 ? sotSummary.revenueUSD / sotSummary.costUSD : 0;
          sotSummary.margin = sotSummary.revenueUSD > 0 ? (sotSummary.revenueUSD - sotSummary.costUSD) / sotSummary.revenueUSD : 0;
          if (!sotSummary.flags) sotSummary.flags = [];
          sotSummary.flags.push('COSTS_FROM_SOT');
        } else if (costsSotData && !sotSummary) {
          sotSummary = {
            revenueUSD: 0,
            costUSD: costsSotData.costUSDNormalized,
            profitUSD: -costsSotData.costUSDNormalized,
            markup: null,
            margin: -1,
            revenueDisplay: 0,
            costDisplay: costsSotData.costDisplay.amount,
            currencyNative: costsSotData.costDisplay.currency,
            flags: ['COSTS_FROM_SOT', 'NO_REVENUE_DATA']
          };
        }

        if (!sotSummary && !costsSotData) {
          console.warn(`⚠️ SoT: No data for project=${projectKey} period=${period}, using ActiveProjectsAggregator`);
          const aggregator = new ActiveProjectsAggregator(storage);
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
          }
        }
      } catch (error) {
        console.warn(`⚠️ SoT error:`, error);
      }
    }

    const pm = await computeProjectPeriodMetrics(projectData.id, timeFilterQuery || period, basis === 'EXEC' ? 'EXEC' : 'ECON');

    const revenueUSD = sotSummary?.revenueUSD ?? pm.summary?.revenueUSD ?? 0;
    const teamCostUSD = sotSummary?.costUSD ?? pm.summary?.teamCostUSD ?? 0;
    const markupUSD = revenueUSD - teamCostUSD;

    let summary = {
      period,
      basis,
      activeMembers: (pm.teamBreakdown ?? []).filter(p => (p.actualHours ?? 0) > 0).length,
      totalHours: pm.summary?.totalHours,
      efficiencyPct: pm.summary?.efficiencyPct,
      teamCostUSD,
      revenueUSD,
      markupUSD,
      emptyStates: pm.summary?.emptyStates ?? { costos: false, ingresos: false, horas: false, objetivos: false },
      hasData: pm.summary?.hasData ?? { costos: true, ingresos: true },
      ...(sotSummary && {
        revenueDisplay: sotSummary.revenueDisplay,
        costDisplay: sotSummary.costDisplay,
        currencyNative: sotSummary.currencyNative,
        markup: sotSummary.markup,
        margin: sotSummary.margin,
        flags: sotSummary.flags
      })
    };

    const normHours = (x?: number, context?: string): number => {
      if (!Number.isFinite(x as number)) return 0;
      const val = x as number;
      if (val > 500) return val / 100;
      return val;
    };

    const fxMes = sotSummary?.currencyNative === 'ARS' && sotSummary?.revenueUSD && sotSummary?.revenueDisplay
      ? sotSummary.revenueDisplay / sotSummary.revenueUSD
      : 1345;

    const hydrateMember = (m: any) => {
      const safeNum = (val: any): number | null => {
        const n = Number(val);
        return Number.isFinite(n) ? n : null;
      };
      const targetHours = safeNum(m.targetHours ?? m.estimatedHours) ?? 0;
      const hoursAsanaRaw = safeNum(m.hoursAsana) ?? safeNum(m.horasRealesAsana) ?? safeNum(m.hours ?? m.actualHours) ?? safeNum(m.hoursBilling) ?? 0;
      const hoursAsana = normHours(hoursAsanaRaw);
      const billingRaw = safeNum(m.hoursBilling ?? m.horasParaFacturacion);
      const hoursBilling = (() => {
        if (billingRaw && billingRaw > 0) return normHours(billingRaw);
        if (hoursAsana > 0) return hoursAsana;
        return targetHours;
      })();
      const rateARS = Number(m.hourlyRateARS ?? m.rateARS ?? m.rate ?? 0);
      const costARS = Number(m.costARS ?? (hoursBilling * rateARS || 0));
      const costUSD = Number(m.costUSD ?? (fxMes ? costARS / fxMes : 0));
      return {
        personnelId: String(m.personnelId ?? m.name ?? 'unknown'),
        name: m.name,
        roleName: m.roleName ?? m.role ?? 'N/A',
        targetHours, hoursAsana, hoursBilling,
        hours: hoursAsana,
        costARS, costUSD, hourlyRateARS: rateARS,
        estimatedHours: targetHours, actualHours: hoursAsana, actualCost: costUSD,
        budgetedCost: m.budgetCost ?? 0,
        rate: rateARS > 0 ? rateARS : null,
        efficiency: m.efficiency ?? 70
      };
    };

    const teamBreakdown = (pm.teamBreakdown ?? []).map(hydrateMember);

    const legacy = {
      estimatedHours: (pm.teamBreakdown ?? []).reduce((sum, p) => sum + (p.targetHours ?? 0), 0),
      workedHours: pm.summary?.totalHours ?? null,
      totalCost: pm.summary?.teamCostUSD ?? null,
      markup: pm.summary?.markupUSD ?? null
    };

    const totalAsanaHours = teamBreakdown.reduce((sum, m) => sum + (m.hoursAsana || 0), 0);
    const totalBillingHours = teamBreakdown.reduce((sum, m) => sum + (m.hoursBilling || 0), 0);
    const totalTargetHours = teamBreakdown.reduce((sum, m) => sum + (m.targetHours || 0), 0);

    const actualsData = {
      totalWorkedCost: summary.teamCostUSD,
      totalWorkedRevenue: summary.revenueUSD,
      totalWorkedHours: summary.totalHours,
      totalAsanaHours,
      totalBillingHours,
      totalEntries: teamBreakdown.length,
      teamBreakdown
    };

    const correctMarkupRatio = sotSummary?.markup ?? (summary.teamCostUSD > 0 ? (summary.revenueUSD / summary.teamCostUSD) : 0);
    const correctMarginRatio = sotSummary?.margin ?? (summary.revenueUSD > 0 ? ((summary.revenueUSD - summary.teamCostUSD) / summary.revenueUSD) : 0);

    const currencyNative = summary.currencyNative || 'ARS';
    const fxRate = 1345;

    let totalAmountNative = quotationData?.totalAmount || 0;
    let cotizacion = totalAmountNative;

    if (view === 'operativa' && (quotationData?.quotationCurrency === 'USD' || currencyNative === 'USD')) {
      cotizacion = summary.revenueDisplay || summary.revenueUSD || totalAmountNative;
      totalAmountNative = cotizacion;
    } else if (quotationData) {
      if (quotationData.quotationCurrency === 'USD' && currencyNative === 'ARS') {
        totalAmountNative = quotationData.totalAmount * fxRate;
        cotizacion = totalAmountNative;
      } else if (quotationData.quotationCurrency === 'ARS' && currencyNative === 'USD') {
        totalAmountNative = quotationData.totalAmount / fxRate;
        cotizacion = totalAmountNative;
      } else {
        totalAmountNative = quotationData.totalAmount;
        cotizacion = totalAmountNative;
      }
    }

    const budgetUtilization = cotizacion > 0 && summary.costDisplay
      ? summary.costDisplay / cotizacion
      : 0;

    const legacyFlags = [...(summary.flags || []), 'LEGACY_FALLBACK'];

    const detailedLaborCost = teamBreakdown.reduce((sum, m) => sum + ((m.costUSD || m.costARS || 0)), 0);
    const rcCost = summary.costDisplay || summary.teamCostUSD || 0;
    const laborMismatchPct = rcCost > 0 ? Math.abs(detailedLaborCost - rcCost) / rcCost : 0;
    if (laborMismatchPct > 0.10) legacyFlags.push('labor_vs_rc_cost_mismatch');

    const isOneShot = quotationData?.quotationType === 'one-time';
    const hasRevenueInPeriod = (summary.revenueDisplay || summary.revenueUSD || 0) > 0;

    let periodWithRevenue: string | null = null;
    if (isOneShot) {
      legacyFlags.push('one_shot_project');
      if (!hasRevenueInPeriod) {
        legacyFlags.push('one_shot_no_revenue_this_period');
        try {
          const { factRCMonth } = await import('../../shared/schema');
          const { eq, and, or, sql } = await import('drizzle-orm');
          const revenueRecords = await db.select({ periodKey: factRCMonth.periodKey })
            .from(factRCMonth)
            .where(and(
              eq(factRCMonth.projectId, resolvedProjectId),
              or(sql`CAST(${factRCMonth.revenueUSD} AS NUMERIC) > 0`, sql`CAST(${factRCMonth.revenueARS} AS NUMERIC) > 0`)
            ))
            .orderBy(factRCMonth.periodKey);
          if (revenueRecords.length > 0) periodWithRevenue = revenueRecords[0].periodKey;
        } catch (error) {
          console.error('❌ Error finding period with revenue:', error);
        }
      } else {
        periodWithRevenue = period;
      }
    }

    let previousPeriodData: any = null;
    const previousPeriod = getPreviousPeriod(period);

    if (previousPeriod && !lifetimeMode) {
      try {
        const prevPM = await computeProjectPeriodMetrics(projectData.id, previousPeriod, basis === 'EXEC' ? 'EXEC' : 'ECON');
        const prevRevenueUSD = prevPM.summary?.revenueUSD ?? 0;
        const prevTeamCostUSD = prevPM.summary?.teamCostUSD ?? 0;
        const prevTotalHours = prevPM.summary?.totalHours ?? 0;
        const prevEfficiencyPct = prevPM.summary?.efficiencyPct ?? 0;
        const prevTeamMembers = (prevPM.teamBreakdown ?? []).filter(p => (p.actualHours ?? 0) > 0).length;
        previousPeriodData = {
          period: previousPeriod,
          hasData: prevTotalHours > 0 || prevRevenueUSD > 0 || prevTeamCostUSD > 0,
          metrics: {
            revenueUSD: prevRevenueUSD, teamCostUSD: prevTeamCostUSD, totalHours: prevTotalHours,
            efficiencyPct: prevEfficiencyPct, teamMembers: prevTeamMembers,
            markup: prevTeamCostUSD > 0 ? prevRevenueUSD / prevTeamCostUSD : 0,
            margin: prevRevenueUSD > 0 ? (prevRevenueUSD - prevTeamCostUSD) / prevRevenueUSD : 0
          }
        };
      } catch (error) {
        console.warn(`⚠️ DELTA: Could not fetch previous period ${previousPeriod}:`, error);
        previousPeriodData = { period: previousPeriod, hasData: false, metrics: null };
      }
    }

    return res.json(redactFinancialProjectData({
      view,
      project: {
        id: projectData.id, clientId: projectData.clientId, status: projectData.status,
        revenueDisplay: summary.revenueDisplay || summary.revenueUSD,
        costDisplay: summary.costDisplay || summary.teamCostUSD,
        cotizacion, currencyNative, budgetUtilization,
        name: quotationData?.projectName || null,
        isOneShot, hasRevenueInPeriod, periodWithRevenue
      },
      quotation: quotationData ? {
        id: quotationData.id, projectName: quotationData.projectName, baseCost: quotationData.baseCost,
        totalAmount: quotationData.totalAmount, totalAmountNative,
        estimatedHours: legacy.estimatedHours || -1,
        markupAmount: quotationData.markupAmount, marginFactor: quotationData.marginFactor
      } : null,
      actuals: actualsData,
      metrics: {
        efficiency: summary.efficiencyPct, markup: correctMarkupRatio, margin: correctMarginRatio,
        budgetUtilization, hoursDeviation: 0, costDeviation: 0
      },
      summary: { ...summary, flags: legacyFlags },
      teamBreakdown,
      ingresos: pm.ingresos ?? [],
      costos: pm.costos ?? [],
      estimatedHours: legacy.estimatedHours,
      workedHours: legacy.workedHours,
      totalCost: legacy.totalCost,
      totalRealRevenue: summary.revenueUSD,
      previousPeriod: previousPeriodData
    }, canSeeFinancials));
  } catch (e: any) {
    console.error('❌ COMPLETE-DATA ERROR:', e.message);
    return res.status(500).json({ error: 'complete-data failed', detail: e?.message });
  }
}
