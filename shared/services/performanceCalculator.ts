/**
 * Performance Calculator Universal - Motor único de cálculo de performance
 * Centraliza lógica: ΣK, ΣL, eficiencia equipo, velocity según plan
 */

export interface PerformanceInput {
  persona: string;
  horasObjetivo: number; // K
  horasReales: number;   // L
  horasFacturacion: number; // M
  projectId: string;
  period: string;
}

export interface PersonPerformance {
  persona: string;
  horasObjetivo: number; // ΣK por persona
  horasReales: number;   // ΣL por persona  
  horasFacturacion: number; // ΣM por persona
  eficiencia: number;    // K=0 ? 70 : MIN(1, L/K)*100
  entries: number;       // Número de registros
}

export interface TeamPerformance {
  period: string;
  totalObjetivo: number; // ΣΣK del equipo
  totalReales: number;   // ΣΣL del equipo
  totalFacturacion: number; // ΣΣM del equipo
  eficienciaEquipo: number; // K=0 ? 70 : MIN(1, ΣL/ΣK)*100
  velocidadSemanal: number; // ΣL / semanas_del_periodo
  miembrosActivos: number;
  breakdown: PersonPerformance[];
}

/**
 * Calculador de performance universal según plan
 * @param inputs - Array de registros de horas/costos del período
 * @param period - Período para cálculo de velocity semanal
 */
export function calculatePerformance(
  inputs: PerformanceInput[],
  period: string
): TeamPerformance {
  
  console.log(`⚡ PERFORMANCE: Processing ${inputs.length} records for ${period}`);

  // 1. Agregar por persona (ΣK, ΣL, ΣM por persona)
  const byPerson = new Map<string, {
    horasObjetivo: number;
    horasReales: number;
    horasFacturacion: number;
    entries: number;
  }>();

  for (const input of inputs) {
    const persona = input.persona;
    if (!byPerson.has(persona)) {
      byPerson.set(persona, {
        horasObjetivo: 0,
        horasReales: 0,
        horasFacturacion: 0,
        entries: 0
      });
    }

    const person = byPerson.get(persona)!;
    person.horasObjetivo += input.horasObjetivo;
    person.horasReales += input.horasReales;
    person.horasFacturacion += input.horasFacturacion;
    person.entries++;
  }

  // 2. Calcular eficiencia por persona
  const breakdown: PersonPerformance[] = [];
  let totalObjetivo = 0;
  let totalReales = 0;
  let totalFacturacion = 0;

  for (const [persona, data] of byPerson) {
    // Eficiencia según plan: K=0 ? 70 : MIN(1, L/K)*100
    const eficiencia = data.horasObjetivo === 0 
      ? 70 
      : Math.min(1, data.horasReales / data.horasObjetivo) * 100;

    breakdown.push({
      persona,
      horasObjetivo: data.horasObjetivo,
      horasReales: data.horasReales,
      horasFacturacion: data.horasFacturacion,
      eficiencia,
      entries: data.entries
    });

    totalObjetivo += data.horasObjetivo;
    totalReales += data.horasReales;
    totalFacturacion += data.horasFacturacion;
  }

  // 3. Eficiencia del equipo
  const eficienciaEquipo = totalObjetivo === 0 
    ? 70 
    : Math.min(1, totalReales / totalObjetivo) * 100;

  // 4. Velocity semanal (ΣL / semanas_del_periodo)
  const semanasPeriodo = getWeeksInPeriod(period);
  const velocidadSemanal = semanasPeriodo > 0 ? totalReales / semanasPeriodo : 0;

  // 5. Filtrar miembros activos (actualHours > 0)
  const miembrosActivos = breakdown.filter(p => p.horasReales > 0).length;

  const result: TeamPerformance = {
    period,
    totalObjetivo,
    totalReales,
    totalFacturacion,
    eficienciaEquipo,
    velocidadSemanal,
    miembrosActivos,
    breakdown: breakdown.filter(p => p.horasReales > 0) // Solo miembros activos
  };

  console.log(`⚡ PERFORMANCE Result: Eficiencia=${eficienciaEquipo.toFixed(1)}%, Velocity=${velocidadSemanal.toFixed(1)}h/sem, Activos=${miembrosActivos}`);
  return result;
}

/**
 * Calcular número de semanas en un período
 */
function getWeeksInPeriod(period: string): number {
  try {
    // Casos específicos según formato del período
    if (period.includes('_')) {
      const periodLower = period.toLowerCase();
      
      // Meses específicos (julio_2025, august_2025, etc.)
      if (periodLower.includes('january') || periodLower.includes('enero')) return 4.3;
      if (periodLower.includes('february') || periodLower.includes('febrero')) return 4.0;
      if (periodLower.includes('march') || periodLower.includes('marzo')) return 4.3;
      if (periodLower.includes('april') || periodLower.includes('abril')) return 4.3;
      if (periodLower.includes('may') || periodLower.includes('mayo')) return 4.3;
      if (periodLower.includes('june') || periodLower.includes('junio')) return 4.3;
      if (periodLower.includes('july') || periodLower.includes('julio')) return 4.3;
      if (periodLower.includes('august') || periodLower.includes('agosto')) return 4.3;
      if (periodLower.includes('september') || periodLower.includes('septiembre')) return 4.3;
      if (periodLower.includes('october') || periodLower.includes('octubre')) return 4.3;
      if (periodLower.includes('november') || periodLower.includes('noviembre')) return 4.3;
      if (periodLower.includes('december') || periodLower.includes('diciembre')) return 4.3;
      
      // Trimestres
      if (periodLower.includes('q1') || periodLower.includes('quarter')) return 13;
      if (periodLower.includes('q2')) return 13;
      if (periodLower.includes('q3')) return 13;
      if (periodLower.includes('q4')) return 13;
      
      // Semestres
      if (periodLower.includes('semester') || periodLower.includes('semestre')) return 26;
      
      // Año
      if (periodLower.includes('year') || periodLower.includes('año')) return 52;
    }

    // Formato yyyy-mm
    if (period.match(/^\d{4}-\d{2}$/)) {
      return 4.3; // Promedio semanas por mes
    }

    // Default para otros casos
    return 4.3;
    
  } catch (error) {
    console.warn(`⚠️ Error calculating weeks for period ${period}:`, error);
    return 4.3; // Default seguro
  }
}

/**
 * Crear breakdown para team desde datos existentes
 */
export function createTeamBreakdown(
  teamData: any[],
  period: string
): PersonPerformance[] {
  return teamData
    .filter(member => member.actualHours > 0)
    .map(member => ({
      persona: member.name || member.personnelName,
      horasObjetivo: member.targetHours || member.estimatedHours || 0,
      horasReales: member.actualHours || member.hours || 0,
      horasFacturacion: member.billableHours || member.actualHours || 0,
      eficiencia: member.efficiency || (
        member.targetHours > 0 
          ? Math.min(1, (member.actualHours || 0) / member.targetHours) * 100 
          : 70
      ),
      entries: 1
    }));
}