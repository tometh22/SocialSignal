// Endpoint temporal para reparar routes.ts
// USAR MOTOR ÚNICO - guarantiza consistencia total

app.get('/api/projects/:id/deviation-analysis', requireAuth, async (req, res) => {
  console.log(`🚀 UNIVERSAL DEVIATION ANALYSIS - Project ${req.params.id}`);
  
  try {
    const projectId = parseInt(req.params.id);
    const { timeFilter = 'current_month', basis = 'ECON' } = req.query;
    
    console.log(`🔍 PARAMS: timeFilter=${timeFilter}, basis=${basis}`);
    
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    // 🎯 USAR MOTOR ÚNICO - garantiza consistencia total con Dashboard y Performance  
    const { computeProjectPeriodMetrics } = require('./domain/metrics');
    const metrics = await computeProjectPeriodMetrics(projectId, timeFilter, basis);
    
    // Crear estructura de desviaciones desde teamBreakdown
    const deviations = metrics.teamBreakdown.map(member => ({
      personnelId: member.personnelId || member.name,
      personnelName: member.name,
      role: member.role,
      budgetedHours: member.targetHours,
      actualHours: member.actualHours,
      budgetedCost: member.budgetCost,
      actualCost: member.actualCost,
      hourDeviation: member.deviationHours,
      costDeviation: member.deviationCost,
      deviationPercentage: member.targetHours > 0 ? 
        Number((member.deviationHours / member.targetHours * 100).toFixed(1)) : 0,
      severity: member.severity,
      alertType: member.deviationHours > 0 ? 'overrun' : member.deviationHours < 0 ? 'underrun' : 'ok',
      deviationType: 'hours'
    }));

    // Ordenar por criticidad (severity + absolute deviation)
    deviations.sort((a, b) => {
      const severityOrder = { 'critical': 3, 'warning': 2, 'normal': 1 };
      return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0) || 
             Math.abs(b.deviationPercentage) - Math.abs(a.deviationPercentage);
    });

    console.log(`📊 UNIVERSAL DEVIATION ANALYSIS RESULT: ${metrics.summary.activeMembers} members, ${metrics.summary.totalHours}h, ${metrics.summary.efficiencyPct}% efficiency, $${metrics.summary.teamCostUSD} cost`);

    // Devolver estructura universal con summary que incluye emptyStates y hasData
    res.json({
      summary: metrics.summary,  // Incluye emptyStates y hasData del motor único
      deviations
    });

  } catch (error) {
    console.error("❌ Universal deviation analysis error:", error);
    res.status(500).json({ message: "Failed to generate deviation analysis" });
  }
});