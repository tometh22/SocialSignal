// routes/complete-data.ts - Fix quirúrgico para summary: null
import type { Request, Response } from 'express';
import { resolveTimeFilter } from '../services/time';
import { computeProjectPeriodMetrics } from '../domain/metrics';

export async function completeDataHandler(req: Request, res: Response) {
  try {
    const projectId = String(req.params.id ?? req.query.projectId ?? '');
    const timeFilter = String(req.query.timeFilter ?? '');
    const basis = (String(req.query.basis ?? 'ECON').toUpperCase() === 'EXEC') ? 'EXEC' : 'ECON';
    
    if (!projectId || !timeFilter) {
      return res.status(400).json({ error: 'projectId and timeFilter are required' });
    }

    console.log(`🌟 COMPLETE-DATA FIX: Project ${projectId}, filter ${timeFilter}, basis ${basis}`);
    
    const pm = await computeProjectPeriodMetrics(parseInt(projectId), timeFilter, basis);

    console.log(`🔍 COMPLETE-DATA METRICS: summary exists: ${!!pm.summary}, teamCostUSD: ${pm.summary?.teamCostUSD}`);

    // --- ADAPTER: PeriodMetrics -> CompleteDataResponse ---
    const summary = {
      period: pm.summary?.period,        // 'YYYY-MM'
      basis,
      activeMembers: (pm.teamBreakdown ?? []).filter(p => (p.actualHours ?? 0) > 0).length,
      totalHours: pm.summary?.totalHours,              // ΣL
      efficiencyPct: pm.summary?.efficiencyPct,       // ΣL/ΣK*100 (K=0→70)
      teamCostUSD: pm.summary?.teamCostUSD,           // Σ actualCost
      revenueUSD: pm.summary?.revenueUSD,
      markupUSD: pm.summary?.markupUSD,               // revenue - teamCost
      emptyStates: pm.summary?.emptyStates ?? { costos: false, ingresos: false, horas: false, objetivos: false },
      hasData: pm.summary?.hasData ?? { costos: true, ingresos: true }
    };

    const teamBreakdown = (pm.teamBreakdown ?? []).map(p => ({
      personnelId: p.personnelId ?? p.name,
      name: p.name,
      role: p.role,
      estimatedHours: p.targetHours ?? 0,
      actualHours: p.actualHours ?? 0,
      actualCost: p.actualCost ?? 0,
      budgetedCost: p.budgetCost ?? 0,
      rate: p.rate ?? null,
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

    return res.json({
      // 🎯 FRONTEND COMPATIBILITY: Map to expected structure
      actuals: actualsData,
      metrics: {
        efficiency: summary.efficiencyPct,
        markup: summary.markupUSD,
        budgetUtilization: 0,
        hoursDeviation: 0,
        costDeviation: 0
      },
      summary,
      teamBreakdown,
      ingresos: pm.ingresos ?? [],
      costos: pm.costos ?? [],
      ...legacy   // <- quitar si no hace falta compat
    });
  } catch (e: any) {
    console.error('❌ COMPLETE-DATA ERROR:', e.message);
    return res.status(500).json({ error: 'complete-data failed', detail: e?.message });
  }
}