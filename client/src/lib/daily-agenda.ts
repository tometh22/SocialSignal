// Modo Daily — lógica pura (sin React) de "qué ítems merecen conversación hoy".
// Vive fuera de la página para poder testearla en node.

export type DailyReasonKind = 'rojo' | 'cambio' | 'vence' | 'decision' | 'silencio' | 'nuevo';
export type DailyReason = { kind: DailyReasonKind; detail: string; question: string };

// Prioridad visual y orden de recorrido en el runner.
export const DAILY_REASON_ORDER: DailyReasonKind[] = ['rojo', 'cambio', 'vence', 'decision', 'silencio', 'nuevo'];

// Chip "sin update" de la vista de lista (ritmo semanal): más de 5 días sin update.
export const STALE_DAYS = 5;
// En la daily el silencio se detecta antes: más de 2 días sin que nadie escriba
// un update y el ítem vuelve a la agenda con "¿sigue vivo?". Se queda ahí hasta
// que alguien deje una línea — "todo igual" sin texto no lo calla.
export const DAILY_SILENCE_DAYS = 2;
// Un deadline entra en la agenda cuando faltan 3 días o menos (o ya venció).
export const DEADLINE_HORIZON_DAYS = 3;

const HEALTH_LABEL: Record<string, string> = { verde: 'verde', amarillo: 'amarillo', rojo: 'rojo' };
const DECISION_LABEL: Record<string, string> = {
  ninguna: 'Ninguna', priorizacion: 'Priorización', recursos: 'Recursos', reprecio: 'Re-precio', salida: 'Salida',
};
const healthLabel = (v: string | null) => HEALTH_LABEL[v ?? 'verde'] ?? 'verde';
export const isUrgentDecision = (v: string | null) => !!v && v !== 'ninguna' && v in DECISION_LABEL;

export type DailyItemInput = {
  isCustom: boolean;
  healthStatus: string | null;
  decisionNeeded: string | null;
  deadline: string | null;
  mainRisk: string | null;
  currentAction: string | null;
  nextMilestone: string | null;
  updatedAt: string | null;
  lastUpdateAt: string | null;
  lastHealthChangeAt: string | null;
  lastHealthChangeFrom: string | null;
  lastDecisionChangeAt: string | null;
  createdAt: string | null;
  ownerName?: string | null;
};

export function relTime(s: string, now: number = Date.now()): string {
  const diff = Math.floor((now - new Date(s).getTime()) / 1000);
  if (diff < 0) return 'ahora';
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)}d`;
  return new Date(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export function isStale(dateStr: string | null, now: number = Date.now()): boolean {
  if (!dateStr) return true;
  return now - new Date(dateStr).getTime() > STALE_DAYS * 86400 * 1000;
}

export function daysBetween(from: string | null, now: number = Date.now()): number {
  if (!from) return Infinity;
  return Math.floor((now - new Date(from).getTime()) / 86400000);
}

export function daysUntil(d: string | null, now: number = Date.now()): number | null {
  if (!d) return null;
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} s`;
  return `${m} min${s > 0 ? ` ${s} s` : ''}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Razones por las que un ítem merece conversación hoy, ordenadas por prioridad.
 * `since` es el cierre de la última daily: lo que cambió después de eso cuenta
 * como novedad. Sin daily previa se toman las últimas 24 h.
 */
export function dailyReasonsFor(item: DailyItemInput, since: Date | null, now: number = Date.now()): DailyReason[] {
  const reasons: DailyReason[] = [];
  const sinceMs = since ? since.getTime() : now - 86400000;
  const isNews = (ts: string | null) => !!ts && new Date(ts).getTime() > sinceMs;

  if (item.healthStatus === 'rojo') {
    const recent = isNews(item.lastHealthChangeAt);
    reasons.push({
      kind: 'rojo',
      detail: recent
        ? `Pasó a rojo ${relTime(item.lastHealthChangeAt!, now)}${item.mainRisk ? ` · ${item.mainRisk}` : ''}`
        : (item.mainRisk || item.currentAction || 'Sigue en rojo'),
      question: '¿qué hacemos hoy?',
    });
  } else if (isNews(item.lastHealthChangeAt)) {
    const from = item.lastHealthChangeFrom ? healthLabel(item.lastHealthChangeFrom) : null;
    reasons.push({
      kind: 'cambio',
      detail: `Pasó ${from ? `de ${from} ` : ''}a ${healthLabel(item.healthStatus)} ${relTime(item.lastHealthChangeAt!, now)}`,
      question: '¿por qué cambió?',
    });
  }

  const du = daysUntil(item.deadline, now);
  if (du !== null && du <= DEADLINE_HORIZON_DAYS) {
    const when = du < 0 ? `Venció hace ${plural(-du, 'día', 'días')}`
      : du === 0 ? 'Vence hoy'
      : du === 1 ? 'Vence mañana'
      : `Vence en ${du} días`;
    reasons.push({ kind: 'vence', detail: `${when}${item.nextMilestone ? ` · ${item.nextMilestone}` : ''}`, question: du < 0 ? '¿qué pasó?' : '¿llega?' });
  }

  if (isUrgentDecision(item.decisionNeeded)) {
    const d = daysBetween(item.lastDecisionChangeAt, now);
    reasons.push({
      kind: 'decision',
      detail: `${DECISION_LABEL[item.decisionNeeded!]} pendiente${Number.isFinite(d) && d > 0 ? ` hace ${plural(d, 'día', 'días')}` : ''}`,
      question: '¿se resuelve?',
    });
  }

  const lastTouch = item.lastUpdateAt || item.updatedAt;
  const d = daysBetween(lastTouch, now);
  if (d > DAILY_SILENCE_DAYS) {
    const last = item.currentAction ? ` · última: "${item.currentAction.slice(0, 60)}${item.currentAction.length > 60 ? '…' : ''}"` : '';
    reasons.push({
      kind: 'silencio',
      detail: Number.isFinite(d) ? `Sin novedades hace ${d} días${last}` : 'Nunca tuvo un update',
      question: '¿sigue vivo?',
    });
  }

  if (item.isCustom && reasons.length === 0 && isNews(item.createdAt)) {
    reasons.push({
      kind: 'nuevo',
      detail: `Creado ${relTime(item.createdAt!, now)}${item.ownerName ? ` · lo lleva ${item.ownerName.split(' ')[0]}` : ''}`,
      question: item.ownerName ? '¿arrancamos?' : '¿quién lo lleva?',
    });
  }

  return reasons.sort((a, b) => DAILY_REASON_ORDER.indexOf(a.kind) - DAILY_REASON_ORDER.indexOf(b.kind));
}
