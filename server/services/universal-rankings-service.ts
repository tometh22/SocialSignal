/**
 * Servicio universal de rankings - REFACTORIZADO
 * Usa el MISMO MOTOR (view-aggregator) que complete-data
 * Arquitectura 3-hours: targetHours, hoursAsana, hoursBilling
 */

export interface UniversalRankingsRequest {
  projectId: string | number;
  timeFilter?: string;
  start?: string;
  end?: string;
}

export interface UniversalRankingsResponse {
  rankings: any[];
  totalEconomicoPeriodo: number;
  periodLabel: string;
  period: { start: string; end: string };
  metadata: {
    universalSystem: boolean;
    projectKey: string;
    spreadsheetId: string;
    filteredRows: number;
    originalRows: number;
  };
  validaciones?: any;
  configuracion?: any;
}

/**
 * Parse timeFilter to period (YYYY-MM or 'all')
 */
function parseTimeFilterToPeriod(timeFilter: string): string {
  // Handle 'all' case
  if (timeFilter === 'all') {
    return 'all';
  }
  
  // august_2025 → 2025-08
  const parts = timeFilter.split('_');
  if (parts.length === 2) {
    const monthMap: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04',
      may: '05', june: '06', july: '07', august: '08',
      september: '09', october: '10', november: '11', december: '12'
    };
    const month = monthMap[parts[0].toLowerCase()];
    const year = parts[1];
    if (month && year) {
      return `${year}-${month}`;
    }
  }
  
  // Already in YYYY-MM format
  if (/^\d{4}-\d{2}$/.test(timeFilter)) {
    return timeFilter;
  }
  
  // Default: current month
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Calcula score de eficiencia individual (0-100)
 * Basado en hoursAsana vs targetHours
 */
function calcularEficienciaScore(hoursAsana: number, targetHours: number): number {
  if (targetHours === 0) return 70; // Sin objetivo = neutro
  
  const efficiency = (hoursAsana / targetHours) * 100;
  
  // Score basado en cumplimiento
  if (efficiency <= 100) {
    // Dentro o bajo objetivo: 70-100 pts
    return 70 + (efficiency / 100) * 30;
  } else {
    // Sobre objetivo: penalización
    const overrun = efficiency - 100;
    return Math.max(0, 70 - overrun * 0.5); // -0.5 pts por cada % de sobrecosto
  }
}

/**
 * Calcula score de impacto económico (0-100)
 * Combina eficiencia con participación en ingresos
 */
function calcularImpactoScore(
  eficienciaScore: number, 
  participacionPct: number
): number {
  // Participación típica: 5-30%
  // Normalizar a 0-100: 30% participación = 100 pts
  const participacionNormalizada = Math.min(100, (participacionPct / 30) * 100);
  
  // Impacto = eficiencia * peso de participación
  return (eficienciaScore * participacionNormalizada) / 100;
}

/**
 * Clasificación por score
 */
function clasificar(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Excelente', color: 'text-green-600' };
  if (score >= 50) return { label: 'Bueno', color: 'text-yellow-600' };
  return { label: 'Crítico', color: 'text-red-600' };
}

export async function getUniversalRankings(request: UniversalRankingsRequest): Promise<UniversalRankingsResponse> {
  const { projectId, timeFilter = 'august_2025', start, end } = request;
  
  console.log(`🌟 UNIVERSAL RANKINGS (NEW): Project ${projectId}, filter ${timeFilter}`);
  
  try {
    const numericProjectId = Number(projectId);
    const period = parseTimeFilterToPeriod(timeFilter);
    
    // 🎯 USAR MISMO AGGREGATOR que complete-data (garantiza 3-hours + ANTI_×100)
    const { getProjectPeriodView } = await import('../domain/view-aggregator.js');
    const viewData = await getProjectPeriodView(numericProjectId, period, 'operativa');

    if (!viewData) {
      console.warn(`⚠️ No view data for project ${projectId}, period ${period}`);
      return {
        rankings: [],
        totalEconomicoPeriodo: 0,
        periodLabel: timeFilter,
        period: { start: period, end: period },
        metadata: {
          universalSystem: true,
          projectKey: `project_${projectId}`,
          spreadsheetId: 'N/A',
          filteredRows: 0,
          originalRows: 0
        }
      };
    }

    const teamBreakdown = viewData.teamBreakdown || [];
    const totalRevenue = viewData.revenueDisplay || 1;
    
    console.log(`📊 RANKINGS: Procesando ${teamBreakdown.length} miembros con datos 3-hours`);

    // Construir rankings con la MISMA DATA que usa el frontend
    const rankings = teamBreakdown.map((member: any) => {
      const hoursAsana = member.hoursAsana || member.actualHours || 0;
      const targetHours = member.targetHours || member.estimatedHours || 0;
      const cost = member.actualCost || member.costUSD || 0;
      
      // Calcular participación en ingresos (proxy: costo / revenue)
      const participacionPct = totalRevenue > 0 ? (cost / totalRevenue) * 100 : 0;
      
      // Scores
      const eficienciaScore = calcularEficienciaScore(hoursAsana, targetHours);
      const impactoScore = calcularImpactoScore(eficienciaScore, participacionPct);
      const unificadoScore = (eficienciaScore + impactoScore) / 2; // Balance 50/50
      
      return {
        persona: member.name || member.personnelName || 'Sin nombre',
        eficiencia: {
          score: Math.round(eficienciaScore),
          display: `${Math.round(eficienciaScore)}%`,
          clasificacion: clasificar(eficienciaScore)
        },
        impacto: {
          score: Math.round(impactoScore),
          scoreDecimal: impactoScore,
          display: `${Math.round(impactoScore)} pts`,
          clasificacion: clasificar(impactoScore)
        },
        unificado: {
          score: Math.round(unificadoScore),
          display: `${unificadoScore.toFixed(1)} pts`,
          clasificacion: clasificar(unificadoScore)
        },
        horas: {
          real: hoursAsana,      // ✅ Usa hoursAsana (ya normalizado con ANTI_×100)
          objetivo: targetHours  // ✅ Usa targetHours (budgeted)
        },
        economia: {
          participacion_pct: Math.round(participacionPct * 10) / 10
        }
      };
    });

    // Ordenar por score unificado (descendente)
    rankings.sort((a: any, b: any) => b.unificado.score - a.unificado.score);

    console.log(`✅ RANKINGS calculados: ${rankings.length} miembros`);
    console.log(`📊 Top 3:`, rankings.slice(0, 3).map((r: any) => `${r.persona}: ${r.unificado.score} pts`));

    // Validaciones
    const validaciones = {
      datosCompletos: rankings.length,
      sinObjetivo: rankings.filter((r: any) => r.horas.objetivo === 0).length,
      participacionTotal: rankings.reduce((sum: number, r: any) => sum + r.economia.participacion_pct, 0),
      noDataForPeriod: rankings.length === 0,
      sinIngresos: totalRevenue <= 1e-6,
      totalEconomicoPeriodo: totalRevenue,
      totalMembers: rankings.length
    };

    const configuracion = {
      balanceEficienciaImpacto: "50-50",
      periodoAnalisis: timeFilter,
      algoritmo: "3hours_architecture",
      version: "2025.10.14",
      motor: "view-aggregator"
    };

    return {
      rankings,
      totalEconomicoPeriodo: totalRevenue,
      periodLabel: timeFilter,
      period: { start: period, end: period },
      metadata: {
        universalSystem: true,
        projectKey: `project_${projectId}`,
        spreadsheetId: 'N/A',
        filteredRows: rankings.length,
        originalRows: rankings.length
      },
      validaciones,
      configuracion
    };

  } catch (error) {
    console.error('❌ Error in universal rankings:', error);
    throw error;
  }
}
