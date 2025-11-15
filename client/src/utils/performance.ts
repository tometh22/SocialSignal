/**
 * 🎯 Unified Performance Metrics System
 * 
 * Single source of truth for team member performance evaluation
 * Using ±5% thresholds for utilization vs target hours
 */

export type PerformanceStatus = 'alto' | 'bajo' | 'normal' | 'unknown';

export interface UtilizationResult {
  status: PerformanceStatus;
  utilization: number;
  label: string;
  emoji: string;
  colorClass: string;
  bgColorClass: string;
  borderColorClass: string;
  progressBarClass: string;
}

/**
 * Calculate utilization status based on worked hours vs target hours
 * 
 * @param workedHours - Actual hours worked (hoursAsana, hours, etc.)
 * @param targetHours - Expected/budgeted hours
 * @returns UtilizationResult with status, colors, and labels
 * 
 * Thresholds:
 * - Alto (High): ≥105% utilization (over target by 5% or more)
 * - Bajo (Low): ≤95% utilization (under target by 5% or more)
 * - Normal: 95-105% utilization (within ±5% of target)
 * - Unknown: No target available
 */
export function getUtilizationStatus(
  workedHours: number,
  targetHours: number
): UtilizationResult {
  // Handle edge cases
  if (!targetHours || targetHours <= 0) {
    return {
      status: 'unknown',
      utilization: 0,
      label: 'Sin meta',
      emoji: '❓',
      colorClass: 'text-gray-600',
      bgColorClass: 'bg-gray-50',
      borderColorClass: 'border-gray-500',
      progressBarClass: 'bg-gray-400'
    };
  }

  const utilization = (workedHours / targetHours) * 100;

  if (utilization >= 105) {
    return {
      status: 'alto',
      utilization,
      label: 'Alto',
      emoji: '📈',
      colorClass: 'text-orange-700',
      bgColorClass: 'bg-orange-50',
      borderColorClass: 'border-orange-500',
      progressBarClass: 'bg-orange-500'
    };
  }

  if (utilization <= 95) {
    return {
      status: 'bajo',
      utilization,
      label: 'Bajo',
      emoji: '📉',
      colorClass: 'text-blue-700',
      bgColorClass: 'bg-blue-50',
      borderColorClass: 'border-blue-500',
      progressBarClass: 'bg-blue-500'
    };
  }

  return {
    status: 'normal',
    utilization,
    label: 'Normal',
    emoji: '✓',
    colorClass: 'text-green-700',
    bgColorClass: 'bg-green-50',
    borderColorClass: 'border-green-500',
    progressBarClass: 'bg-green-500'
  };
}

/**
 * Get overworked team members based on utilization thresholds
 * 
 * @param team - Array of team members with hoursAsana and targetHours
 * @returns Array of members with ≥105% utilization
 */
export function getOverworkedMembers(team: Array<{ hoursAsana?: number; targetHours?: number; name: string }>): Array<{ name: string; utilization: number }> {
  return team
    .map(member => {
      const result = getUtilizationStatus(member.hoursAsana || 0, member.targetHours || 0);
      return {
        name: member.name,
        utilization: result.utilization
      };
    })
    .filter(member => member.utilization >= 105);
}

/**
 * Get underutilized team members based on utilization thresholds
 * 
 * @param team - Array of team members with hoursAsana and targetHours
 * @returns Array of members with ≤95% utilization
 */
export function getUnderutilizedMembers(team: Array<{ hoursAsana?: number; targetHours?: number; name: string }>): Array<{ name: string; utilization: number }> {
  return team
    .map(member => {
      const result = getUtilizationStatus(member.hoursAsana || 0, member.targetHours || 0);
      return {
        name: member.name,
        utilization: result.utilization
      };
    })
    .filter(member => member.utilization > 0 && member.utilization <= 95);
}
