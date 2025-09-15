/**
 * Rankings System según Especificación del Documento
 * 
 * Implementación exacta de la especificación técnica proporcionada:
 * - Eficiencia: horas_reales/horas_objetivo × 100
 * - Impacto: participación × eficiencia × 30 
 * - Unificado: 50% Eficiencia + 50% Impacto_escalado
 */

export interface DocumentRankingEntry {
  persona: string;
  horas_reales: number;
  horas_objetivo: number;
  monto_total_usd: number;
  eficiencia_pct: number;
  participacion_pct: number;
  impacto_pts: number;
  unificado_pts: number;
}

export interface DocumentRankingResult {
  persona: string;
  eficiencia: {
    score: number;
    display: string;
    clasificacion: {
      label: string;
      color: string;
    };
  };
  impacto: {
    score: number;
    display: string;
    clasificacion: {
      label: string;
      color: string;
    };
  };
  unificado: {
    score: number;
    display: string;
    clasificacion: {
      label: string;
      color: string;
    };
  };
  horas: {
    real: number;
    objetivo: number;
  };
  economia: {
    participacion_pct: number;
  };
}

/**
 * Calcula la eficiencia según la especificación: horas_reales/horas_objetivo × 100
 * Si no hay objetivo (K_total=0), usar 70 pts como especifica el documento
 */
export function calculateDocumentEfficiency(horasReales: number, horasObjetivo: number): number {
  if (horasObjetivo === 0) {
    return 70; // Sin objetivo = 70 pts según especificación
  }
  return Math.min(100, (horasReales / horasObjetivo) * 100);
}

/**
 * Calcula el impacto según la especificación: participación × eficiencia × 30
 * Para efic_norm: si K_fila=0, usar 1; si no, MIN(1; L_fila/K_fila)
 */
export function calculateDocumentImpact(participacionPct: number, horasReales: number, horasObjetivo: number): number {
  let eficNorm: number;
  
  if (horasObjetivo === 0) {
    eficNorm = 1; // Sin objetivo no penalizar el reparto
  } else {
    eficNorm = Math.min(1, horasReales / horasObjetivo);
  }
  
  // Escala 0-30: participación × efic_norm × 30
  return (participacionPct / 100) * eficNorm * 30;
}

/**
 * Calcula el score unificado: 50% Eficiencia + 50% Impacto_escalado
 * Impacto_escalado = Impacto/30*100 para normalizar a 0-100
 */
export function calculateDocumentUnified(eficiencia: number, impacto: number): number {
  const impactoEscalado = (impacto / 30) * 100; // Escalar impacto a 0-100
  return (eficiencia * 0.5) + (impactoEscalado * 0.5);
}

/**
 * Calcula la participación económica de cada persona en el proyecto
 * Agrupa por proyecto-mes y reparte los ingresos proporcionalmente
 */
export function calculateParticipacionPorcentajes(
  entries: Array<{persona: string, montoUSD: number}>
): Record<string, number> {
  const totalIngresos = entries.reduce((sum, entry) => sum + entry.montoUSD, 0);
  
  if (totalIngresos === 0) {
    // Si no hay ingresos, repartir equitativamente
    const participacionEquitativa = 100 / entries.length;
    const result: Record<string, number> = {};
    entries.forEach(entry => {
      result[entry.persona] = participacionEquitativa;
    });
    return result;
  }
  
  // Calcular participación real basada en montos
  const result: Record<string, number> = {};
  entries.forEach(entry => {
    result[entry.persona] = (entry.montoUSD / totalIngresos) * 100;
  });
  
  return result;
}

/**
 * Clasificación según umbrales de la especificación
 */
export function getDocumentClassification(score: number, type: 'eficiencia' | 'impacto' | 'unificado') {
  if (type === 'eficiencia' || type === 'unificado') {
    // Umbrales para eficiencia y unificado (escala 0-100)
    if (score >= 70) return { label: "Excelente", color: "green" };
    if (score >= 50) return { label: "Bueno", color: "yellow" };
    return { label: "Crítico", color: "red" };
  } else if (type === 'impacto') {
    // Umbrales para impacto (escala 0-30): ≥15 Excelente; 8-14 Bueno; <8 Crítico
    if (score >= 15) return { label: "Excelente", color: "green" };
    if (score >= 8) return { label: "Bueno", color: "yellow" };
    return { label: "Crítico", color: "red" };
  }
  
  return { label: "Crítico", color: "red" };
}

/**
 * Procesa datos de entrada y genera rankings según la especificación del documento
 */
export function processDocumentRankings(
  teamData: Array<{
    persona: string;
    horasReales: number;
    horasObjetivo: number;
    montoUSD: number;
  }>
): DocumentRankingResult[] {
  // Filtrar solo personas con datos mínimos significativos
  const validEntries = teamData.filter(entry => 
    (entry.horasReales > 0 || entry.montoUSD > 0) && 
    (entry.horasObjetivo > 0 || entry.montoUSD > 0)
  );
  
  if (validEntries.length === 0) {
    console.log("📊 No hay datos suficientes para generar rankings");
    return [];
  }
  
  // Calcular participaciones económicas
  const participaciones = calculateParticipacionPorcentajes(
    validEntries.map(e => ({persona: e.persona, montoUSD: e.montoUSD}))
  );
  
  // Procesar cada entrada
  const results: DocumentRankingResult[] = validEntries.map(entry => {
    const participacionPct = participaciones[entry.persona] || 0;
    
    // Calcular métricas según especificación
    const eficiencia = calculateDocumentEfficiency(entry.horasReales, entry.horasObjetivo);
    const impacto = calculateDocumentImpact(participacionPct, entry.horasReales, entry.horasObjetivo);
    const unificado = calculateDocumentUnified(eficiencia, impacto);
    
    console.log(`📊 ${entry.persona}: Eficiencia=${eficiencia.toFixed(1)}, Impacto=${impacto.toFixed(1)}, Unificado=${unificado.toFixed(1)}, Participación=${participacionPct.toFixed(2)}%`);
    
    return {
      persona: entry.persona,
      eficiencia: {
        score: Math.round(eficiencia),
        display: `${Math.round(eficiencia)}% eficiencia`,
        clasificacion: getDocumentClassification(eficiencia, 'eficiencia')
      },
      impacto: {
        score: Math.round(impacto),
        display: `${Math.round(impacto)} pts impacto`,
        clasificacion: getDocumentClassification(impacto, 'impacto')
      },
      unificado: {
        score: Math.round(unificado),
        display: `${Math.round(unificado)} pts total`,
        clasificacion: getDocumentClassification(unificado, 'unificado')
      },
      horas: {
        real: entry.horasReales,
        objetivo: entry.horasObjetivo
      },
      economia: {
        participacion_pct: Math.round(participacionPct * 100) / 100
      }
    };
  });
  
  // Ordenar por unificado descendente
  return results.sort((a, b) => b.unificado.score - a.unificado.score);
}