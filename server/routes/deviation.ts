// routes/deviation.ts (ESM)
import type { Request, Response } from 'express';
import { Router } from 'express';
import { resolveTimeFilter } from '../services/time';
import { computeProjectPeriodMetrics } from '../domain/metrics';

const router = Router();

const sev = (pct: number) => {
  const ap = Math.abs(pct);
  if (ap >= 30) return 'critical';
  if (ap >= 15) return 'high';
  if (ap >= 5)  return 'medium';
  return 'low';
};

async function deviationAnalysisHandler(req: Request, res: Response) {
  try {
    const projectId = parseInt(req.params.id ?? req.query.projectId ?? '0');
    const timeFilter = String(req.query.timeFilter ?? '');
    const basis = (String(req.query.basis ?? 'ECON').toUpperCase() === 'EXEC') ? 'EXEC' : 'ECON';

    if (isNaN(projectId) || !timeFilter) {
      return res.status(400).json({ error: 'projectId and timeFilter are required' });
    }

    const tf = resolveTimeFilter(timeFilter); // {start,end, period:'YYYY-MM'}
    const data = await computeProjectPeriodMetrics(projectId, timeFilter, basis);

    // data.teamBreakdown debe traer por persona: targetHours, actualHours, budgetCost, actualCost, name, personnelId
    const deviations = (data.teamBreakdown ?? []).map(p => {
      const targetHours = Number(p.targetHours ?? 0);
      const actualHours = Number(p.actualHours ?? 0);
      const deviationPct = targetHours === 0 ? 0 : ((actualHours / targetHours) - 1) * 100;
      return {
        personnelId: p.personnelId ?? p.name,
        personnelName: p.name,
        budgetedHours: targetHours,
        actualHours: actualHours,
        budgetedCost: Number(p.budgetCost ?? 0),
        actualCost: Number(p.actualCost ?? 0),
        hourDeviation: actualHours - targetHours,
        costDeviation: Number(p.actualCost ?? 0) - Number(p.budgetCost ?? 0),
        deviationPercentage: deviationPct,
        severity: sev(deviationPct),
        alertType: targetHours === 0 ? 'no-plan' : (actualHours >= targetHours ? 'overrun' : 'underrun'),
        deviationType: 'hours',
      };
    });

    return res.json({
      summary: {
        period: data.summary?.period,      // 'YYYY-MM'
        basis,
        activeMembers: (data.teamBreakdown ?? []).filter(p => (p.actualHours ?? 0) > 0).length,
        totalHours: data.summary?.totalHours,
        efficiencyPct: data.summary?.efficiencyPct,
        teamCost: basis === 'ECON' ? data.summary?.teamCostUSD : data.summary?.teamCostUSD, // mismo nombre en front
        emptyStates: data.summary?.emptyStates,
        hasData: data.summary?.hasData,
      },
      deviations
    });
  } catch (e:any) {
    return res.status(500).json({ error: 'deviation-analysis failed', detail: e?.message });
  }
}

router.get('/:id/deviation-analysis', deviationAnalysisHandler);

export { router as deviationRouter };