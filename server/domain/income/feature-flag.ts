/**
 * 🚀 FEATURE FLAG - INCOME SOT
 * Controla la migración del sistema legacy al nuevo SoT
 */

/**
 * Feature flag global para activar/desactivar el nuevo sistema de ingresos
 * Durante FASE 1: false = usa sistema viejo, true = usa SoT
 * Durante FASE 2+: siempre true
 */
export const INCOME_SOT_ENABLED = process.env.INCOME_SOT_ENABLED === 'true' || true; // Activado para testing

/**
 * Utilidad para logging condicional del SoT
 */
export function logIncomeSOT(message: string, ...args: any[]): void {
  if (INCOME_SOT_ENABLED) {
    console.log(`🚀 INCOME SoT: ${message}`, ...args);
  }
}

/**
 * Wrapper para ejecutar lógica solo si el SoT está habilitado
 */
export function withIncomeSOT<T>(fn: () => T, fallback: () => T): T {
  return INCOME_SOT_ENABLED ? fn() : fallback();
}