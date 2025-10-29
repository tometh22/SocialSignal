// routes/lifetime-metrics.ts - Project lifetime metrics for one-shot projects
import type { Request, Response } from 'express';
import { db } from '../db';
import { factRCMonth, factLaborMonth, activeProjects, quotations, clients } from '../../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

export async function lifetimeMetricsHandler(req: Request, res: Response) {
  try {
    const projectId = parseInt(req.params.id);
    
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    // Get project and quotation data
    const projectData = await db.query.activeProjects.findFirst({
      where: eq(activeProjects.id, projectId)
    });

    if (!projectData) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const quotationData = projectData.quotationId 
      ? await db.query.quotations.findFirst({
          where: eq(quotations.id, projectData.quotationId)
        })
      : null;

    // Determine if this is a one-shot project
    const isOneShot = quotationData?.quotationType === 'one-time';

    // Get all periods with activity from fact_rc_month and fact_labor_month
    const rcPeriods = await db
      .selectDistinct({ periodKey: factRCMonth.periodKey })
      .from(factRCMonth)
      .where(eq(factRCMonth.projectId, projectId));
    
    const laborPeriods = await db
      .selectDistinct({ periodKey: factLaborMonth.periodKey })
      .from(factLaborMonth)
      .where(eq(factLaborMonth.projectId, projectId));

    const allPeriodsSet = new Set([
      ...rcPeriods.map(p => p.periodKey),
      ...laborPeriods.map(p => p.periodKey)
    ]);
    const allPeriods = Array.from(allPeriodsSet).sort();

    if (allPeriods.length === 0) {
      return res.json({
        projectId,
        isOneShot,
        hasData: false,
        message: "No lifetime data available"
      });
    }

    // Get all RC data for the project
    const rcData = await db
      .select()
      .from(factRCMonth)
      .where(eq(factRCMonth.projectId, projectId))
      .orderBy(factRCMonth.periodKey);

    // Get all labor data for the project
    const laborData = await db
      .select()
      .from(factLaborMonth)
      .where(eq(factLaborMonth.projectId, projectId))
      .orderBy(factLaborMonth.periodKey);

    // Calculate lifetime totals
    const totalRevenueUSD = rcData.reduce((sum, row) => sum + (parseFloat(row.revenueUsd as string) || 0), 0);
    const totalRevenueARS = rcData.reduce((sum, row) => sum + (parseFloat(row.revenueArs as string) || 0), 0);
    const totalCostUSD = rcData.reduce((sum, row) => sum + (parseFloat(row.costUsd as string) || 0), 0);
    const totalCostARS = rcData.reduce((sum, row) => sum + (parseFloat(row.costArs as string) || 0), 0);
    
    const totalAsanaHours = laborData.reduce((sum, row) => sum + (parseFloat(row.asanaHours as string) || 0), 0);
    const totalBillingHours = laborData.reduce((sum, row) => sum + (parseFloat(row.billingHours as string) || 0), 0);
    const totalTargetHours = laborData.reduce((sum, row) => sum + (parseFloat(row.targetHours as string) || 0), 0);

    // Determine native currency (use first RC row with revenue)
    const firstRCWithRevenue = rcData.find(row => 
      (parseFloat(row.revenueUsd as string) || 0) > 0 || (parseFloat(row.revenueArs as string) || 0) > 0
    );
    const currencyNative = firstRCWithRevenue?.currency as string || 'USD';
    const quoteNative = parseFloat(firstRCWithRevenue?.quoteNative as string || '0');
    
    // Calculate display values
    const revenueDisplay = currencyNative === 'ARS' ? totalRevenueARS : totalRevenueUSD;
    const costDisplay = currencyNative === 'ARS' ? totalCostARS : totalCostUSD;
    const profitDisplay = revenueDisplay - costDisplay;
    
    // Calculate metrics
    const markup = totalCostUSD > 0 ? totalRevenueUSD / totalCostUSD : 0;
    const margin = totalRevenueUSD > 0 ? (totalRevenueUSD - totalCostUSD) / totalRevenueUSD : 0;
    const budgetUtilization = quoteNative > 0 ? costDisplay / quoteNative : 0;

    // Find period with revenue (for one-shot projects)
    const periodWithRevenue = rcData.find(row => 
      (parseFloat(row.revenueUsd as string) || 0) > 0 || (parseFloat(row.revenueArs as string) || 0) > 0
    )?.periodKey || null;

    // Monthly breakdown
    const monthlyBreakdown = allPeriods.map(periodKey => {
      const rcRow = rcData.find(r => r.periodKey === periodKey);
      const laborRows = laborData.filter(l => l.periodKey === periodKey);
      
      const revenueUSD = parseFloat(rcRow?.revenueUsd as string || '0');
      const revenueARS = parseFloat(rcRow?.revenueArs as string || '0');
      const costUSD = parseFloat(rcRow?.costUsd as string || '0');
      const costARS = parseFloat(rcRow?.costArs as string || '0');
      
      const asanaHours = laborRows.reduce((sum, l) => sum + (parseFloat(l.asanaHours as string) || 0), 0);
      const billingHours = laborRows.reduce((sum, l) => sum + (parseFloat(l.billingHours as string) || 0), 0);
      
      const hasRevenue = revenueUSD > 0 || revenueARS > 0;
      const hasCost = costUSD > 0 || costARS > 0;
      
      return {
        periodKey,
        revenueUSD,
        revenueARS,
        costUSD,
        costARS,
        revenueDisplay: currencyNative === 'ARS' ? revenueARS : revenueUSD,
        costDisplay: currencyNative === 'ARS' ? costARS : costUSD,
        asanaHours,
        billingHours,
        teamSize: laborRows.length,
        hasRevenue,
        hasCost
      };
    });

    console.log(`📊 LIFETIME METRICS: Project ${projectId} (${quotationData?.projectName}) - ${allPeriods.length} periods, revenue=${currencyNative} ${revenueDisplay.toFixed(2)}, cost=${costDisplay.toFixed(2)}`);

    return res.json({
      projectId,
      projectName: quotationData?.projectName || null,
      isOneShot,
      currencyNative,
      dateRange: {
        firstPeriod: allPeriods[0],
        lastPeriod: allPeriods[allPeriods.length - 1],
        totalPeriods: allPeriods.length
      },
      periodWithRevenue,
      lifetime: {
        revenueUSD: +totalRevenueUSD.toFixed(2),
        costUSD: +totalCostUSD.toFixed(2),
        profitUSD: +(totalRevenueUSD - totalCostUSD).toFixed(2),
        revenueDisplay: +revenueDisplay.toFixed(2),
        costDisplay: +costDisplay.toFixed(2),
        profitDisplay: +profitDisplay.toFixed(2),
        currencyNative,
        quoteNative: +quoteNative.toFixed(2),
        markup: +markup.toFixed(4),
        margin: +margin.toFixed(4),
        budgetUtilization: +budgetUtilization.toFixed(4),
        totalAsanaHours: +totalAsanaHours.toFixed(2),
        totalBillingHours: +totalBillingHours.toFixed(2),
        totalTargetHours: +totalTargetHours.toFixed(2)
      },
      monthly: monthlyBreakdown,
      hasData: true
    });

  } catch (error: any) {
    console.error('❌ LIFETIME-METRICS ERROR:', error.message);
    return res.status(500).json({ error: 'lifetime-metrics failed', detail: error?.message });
  }
}
