/**
 * Smart Alerts Engine
 * Generates actionable alerts based on project health metrics
 * Epical thresholds: markup < 2.5 is critical
 */

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'markup' | 'budget' | 'capacity' | 'deadline' | 'efficiency';
  title: string;
  description: string;
  projectId?: number;
  projectName?: string;
  clientName?: string;
  metric?: number;
  threshold?: number;
  action?: string;
}

interface ProjectData {
  projectId: number;
  projectName: string;
  clientName: string;
  revenue: number;
  cost: number;
  markup: number;
  margin: number;
  budget: number;
  budgetUsed: number;
  totalHours: number;
  estimatedHours: number;
  teamSize: number;
  status: string;
}

interface CapacityData {
  personnelId: number;
  name: string;
  utilizationPct: number;
  idleHours: number;
  maxCapacity: number;
}

// ─── Epical Business Rules ──────────────────────────────────────────────────

const THRESHOLDS = {
  MARKUP_CRITICAL: 2.0,      // Below 2.0x = critical loss
  MARKUP_WARNING: 2.5,       // Below 2.5x = warning (Epical standard)
  MARKUP_GOOD: 3.0,          // Above 3.0x = healthy
  BUDGET_CRITICAL: 90,       // >90% budget consumed
  BUDGET_WARNING: 75,        // >75% budget consumed
  CAPACITY_OVERLOAD: 110,    // >110% utilization
  CAPACITY_IDLE: 40,         // <40% utilization
  HOURS_OVERRUN: 120,        // >120% of estimated hours
};

// ─── Alert Generators ───────────────────────────────────────────────────────

function generateProjectAlerts(projects: ProjectData[]): Alert[] {
  const alerts: Alert[] = [];

  for (const p of projects) {
    if (p.status !== 'active') continue;

    // Markup alerts (Epical core metric)
    if (p.cost > 0 && p.markup < THRESHOLDS.MARKUP_CRITICAL) {
      alerts.push({
        id: `markup-crit-${p.projectId}`,
        type: 'critical',
        category: 'markup',
        title: `Markup crítico: ${p.markup.toFixed(1)}x`,
        description: `${p.projectName} tiene markup ${p.markup.toFixed(1)}x (mínimo: ${THRESHOLDS.MARKUP_WARNING}x). Estamos perdiendo dinero.`,
        projectId: p.projectId,
        projectName: p.projectName,
        clientName: p.clientName,
        metric: p.markup,
        threshold: THRESHOLDS.MARKUP_WARNING,
        action: 'Revisar costos del equipo o renegociar precio con el cliente',
      });
    } else if (p.cost > 0 && p.markup < THRESHOLDS.MARKUP_WARNING) {
      alerts.push({
        id: `markup-warn-${p.projectId}`,
        type: 'warning',
        category: 'markup',
        title: `Markup bajo: ${p.markup.toFixed(1)}x`,
        description: `${p.projectName} tiene markup ${p.markup.toFixed(1)}x, por debajo del estándar Epical de ${THRESHOLDS.MARKUP_WARNING}x.`,
        projectId: p.projectId,
        projectName: p.projectName,
        clientName: p.clientName,
        metric: p.markup,
        threshold: THRESHOLDS.MARKUP_WARNING,
        action: 'Optimizar asignación de equipo o reducir horas senior',
      });
    }

    // Budget alerts
    if (p.budget > 0 && p.budgetUsed > THRESHOLDS.BUDGET_CRITICAL) {
      alerts.push({
        id: `budget-crit-${p.projectId}`,
        type: 'critical',
        category: 'budget',
        title: `Budget agotado: ${p.budgetUsed.toFixed(0)}%`,
        description: `${p.projectName} consumió ${p.budgetUsed.toFixed(0)}% del presupuesto.`,
        projectId: p.projectId,
        projectName: p.projectName,
        clientName: p.clientName,
        metric: p.budgetUsed,
        threshold: THRESHOLDS.BUDGET_CRITICAL,
        action: 'Frenar trabajo adicional o solicitar extensión de presupuesto',
      });
    } else if (p.budget > 0 && p.budgetUsed > THRESHOLDS.BUDGET_WARNING) {
      alerts.push({
        id: `budget-warn-${p.projectId}`,
        type: 'warning',
        category: 'budget',
        title: `Budget alto: ${p.budgetUsed.toFixed(0)}%`,
        description: `${p.projectName} ya consumió ${p.budgetUsed.toFixed(0)}% del presupuesto.`,
        projectId: p.projectId,
        projectName: p.projectName,
        clientName: p.clientName,
        metric: p.budgetUsed,
        threshold: THRESHOLDS.BUDGET_WARNING,
        action: 'Monitorear consumo y planificar cierre',
      });
    }

    // Hours overrun
    if (p.estimatedHours > 0 && p.totalHours > 0) {
      const hoursPct = (p.totalHours / p.estimatedHours) * 100;
      if (hoursPct > THRESHOLDS.HOURS_OVERRUN) {
        alerts.push({
          id: `hours-${p.projectId}`,
          type: 'warning',
          category: 'efficiency',
          title: `Horas excedidas: ${hoursPct.toFixed(0)}%`,
          description: `${p.projectName} usó ${p.totalHours.toFixed(0)}h de ${p.estimatedHours.toFixed(0)}h estimadas.`,
          projectId: p.projectId,
          projectName: p.projectName,
          clientName: p.clientName,
          metric: hoursPct,
          threshold: THRESHOLDS.HOURS_OVERRUN,
          action: 'Revisar scope y eficiencia del equipo',
        });
      }
    }
  }

  return alerts;
}

function generateCapacityAlerts(capacity: CapacityData[]): Alert[] {
  const alerts: Alert[] = [];

  const overloaded = capacity.filter(c => c.utilizationPct > THRESHOLDS.CAPACITY_OVERLOAD);
  const idle = capacity.filter(c => c.utilizationPct < THRESHOLDS.CAPACITY_IDLE && c.maxCapacity > 0);

  if (overloaded.length > 0) {
    alerts.push({
      id: `capacity-overload`,
      type: 'warning',
      category: 'capacity',
      title: `${overloaded.length} persona${overloaded.length > 1 ? 's' : ''} sobrecargada${overloaded.length > 1 ? 's' : ''}`,
      description: overloaded.map(c => `${c.name} (${c.utilizationPct}%)`).join(', '),
      action: 'Redistribuir carga o posponer tareas no urgentes',
    });
  }

  if (idle.length > 2) {
    alerts.push({
      id: `capacity-idle`,
      type: 'info',
      category: 'capacity',
      title: `${idle.length} personas con baja carga`,
      description: `${idle.map(c => c.name).join(', ')} tienen menos de ${THRESHOLDS.CAPACITY_IDLE}% de utilización.`,
      action: 'Asignar a proyectos o tareas internas',
    });
  }

  return alerts;
}

// ─── AI Insights Generator ──────────────────────────────────────────────────

function generateInsights(projects: ProjectData[], alerts: Alert[]): string[] {
  const insights: string[] = [];
  const activeProjects = projects.filter(p => p.status === 'active');

  if (activeProjects.length === 0) return ['No hay proyectos activos para analizar.'];

  // Portfolio health
  const avgMarkup = activeProjects.reduce((s, p) => s + (p.cost > 0 ? p.markup : 0), 0) / activeProjects.filter(p => p.cost > 0).length || 0;
  if (avgMarkup >= THRESHOLDS.MARKUP_GOOD) {
    insights.push(`El portfolio tiene un markup promedio de ${avgMarkup.toFixed(1)}x, por encima del estándar.`);
  } else if (avgMarkup >= THRESHOLDS.MARKUP_WARNING) {
    insights.push(`Markup promedio del portfolio: ${avgMarkup.toFixed(1)}x. Cerca del límite de ${THRESHOLDS.MARKUP_WARNING}x.`);
  } else {
    insights.push(`Markup promedio del portfolio: ${avgMarkup.toFixed(1)}x. Debajo del mínimo de ${THRESHOLDS.MARKUP_WARNING}x. Acción urgente requerida.`);
  }

  // Critical projects
  const criticalCount = alerts.filter(a => a.type === 'critical').length;
  if (criticalCount > 0) {
    insights.push(`Hay ${criticalCount} alerta${criticalCount > 1 ? 's' : ''} crítica${criticalCount > 1 ? 's' : ''} que requieren atención inmediata.`);
  }

  // Best performer
  const best = activeProjects.filter(p => p.cost > 0).sort((a, b) => b.markup - a.markup)[0];
  if (best && best.markup > 0) {
    insights.push(`Mejor proyecto: ${best.projectName} (${best.clientName}) con markup ${best.markup.toFixed(1)}x.`);
  }

  // Revenue concentration
  const totalRevenue = activeProjects.reduce((s, p) => s + p.revenue, 0);
  if (totalRevenue > 0) {
    const topProject = activeProjects.sort((a, b) => b.revenue - a.revenue)[0];
    const concentration = (topProject.revenue / totalRevenue) * 100;
    if (concentration > 50) {
      insights.push(`${topProject.projectName} representa el ${concentration.toFixed(0)}% del revenue total. Alta concentración de riesgo.`);
    }
  }

  return insights;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function computeAlerts(projects: ProjectData[], capacity: CapacityData[] = []): {
  alerts: Alert[];
  insights: string[];
  summary: { critical: number; warning: number; info: number };
} {
  const projectAlerts = generateProjectAlerts(projects);
  const capacityAlerts = generateCapacityAlerts(capacity);
  const allAlerts = [...projectAlerts, ...capacityAlerts]
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.type] - order[b.type];
    });

  const insights = generateInsights(projects, allAlerts);

  return {
    alerts: allAlerts,
    insights,
    summary: {
      critical: allAlerts.filter(a => a.type === 'critical').length,
      warning: allAlerts.filter(a => a.type === 'warning').length,
      info: allAlerts.filter(a => a.type === 'info').length,
    },
  };
}

export { THRESHOLDS };
