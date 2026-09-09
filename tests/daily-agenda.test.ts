/**
 * Modo Daily — qué ítems merecen conversación hoy y por qué.
 * Cubre la lógica pura de client/src/lib/daily-agenda.ts.
 */
import { describe, test, expect } from 'vitest';
import {
  dailyReasonsFor, daysUntil, formatDuration, isStale, DAILY_REASON_ORDER,
  type DailyItemInput,
} from '@/lib/daily-agenda';

const NOW = new Date('2026-09-09T15:00:00').getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3600 * 1000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);
const inDays = (d: number) => new Date(NOW + d * 86400 * 1000).toISOString();

const base = (over: Partial<DailyItemInput> = {}): DailyItemInput => ({
  isCustom: false,
  healthStatus: 'verde',
  decisionNeeded: 'ninguna',
  deadline: null,
  mainRisk: null,
  currentAction: null,
  nextMilestone: null,
  updatedAt: hoursAgo(20),
  lastUpdateAt: hoursAgo(20),
  lastHealthChangeAt: null,
  lastHealthChangeFrom: null,
  lastDecisionChangeAt: null,
  createdAt: daysAgo(30),
  ...over,
});

const kinds = (item: DailyItemInput, since: Date | null = null) => dailyReasonsFor(item, since, NOW).map(r => r.kind);

describe('dailyReasonsFor — ítems sin novedad', () => {
  test('un ítem verde, con update reciente, sin deadline ni decisión, no entra en la agenda', () => {
    expect(kinds(base())).toEqual([]);
  });

  test('un cambio de semáforo anterior a la última daily no cuenta como novedad', () => {
    const item = base({ healthStatus: 'amarillo', lastHealthChangeAt: daysAgo(3), lastHealthChangeFrom: 'verde' });
    expect(kinds(item, new Date(daysAgo(1)))).toEqual([]);
  });
});

describe('dailyReasonsFor — razones individuales', () => {
  test('rojo siempre entra, aunque tenga update fresco', () => {
    const r = dailyReasonsFor(base({ healthStatus: 'rojo', mainRisk: 'Rodri no contesta' }), null, NOW);
    expect(r.map(x => x.kind)).toEqual(['rojo']);
    expect(r[0].detail).toContain('Rodri no contesta');
  });

  test('rojo reciente muestra desde cuándo, no la razón "cambio" duplicada', () => {
    const r = dailyReasonsFor(base({ healthStatus: 'rojo', lastHealthChangeAt: hoursAgo(2), lastHealthChangeFrom: 'amarillo' }), null, NOW);
    expect(r.map(x => x.kind)).toEqual(['rojo']);
    expect(r[0].detail).toMatch(/Pasó a rojo hace 2h/);
  });

  test('cambio de semáforo después de la última daily es "cambio" con el color anterior', () => {
    const since = new Date(daysAgo(1));
    const r = dailyReasonsFor(base({ healthStatus: 'amarillo', lastHealthChangeAt: hoursAgo(3), lastHealthChangeFrom: 'verde' }), since, NOW);
    expect(r.map(x => x.kind)).toEqual(['cambio']);
    expect(r[0].detail).toBe('Pasó de verde a amarillo hace 3h');
  });

  test('sin daily previa, "novedad" significa últimas 24 h', () => {
    expect(kinds(base({ healthStatus: 'amarillo', lastHealthChangeAt: hoursAgo(23) }))).toEqual(['cambio']);
    expect(kinds(base({ healthStatus: 'amarillo', lastHealthChangeAt: hoursAgo(25) }))).toEqual([]);
  });

  test('deadline dentro de 3 días entra como "vence"; a 4 días no', () => {
    expect(kinds(base({ deadline: inDays(3) }))).toEqual(['vence']);
    expect(kinds(base({ deadline: inDays(4) }))).toEqual([]);
  });

  test('deadline vencido pregunta qué pasó', () => {
    const r = dailyReasonsFor(base({ deadline: inDays(-2) }), null, NOW);
    expect(r[0].kind).toBe('vence');
    expect(r[0].detail).toMatch(/^Venció hace 2 días/);
    expect(r[0].question).toBe('¿qué pasó?');
  });

  test('decisión pendiente muestra hace cuánto se pidió', () => {
    const r = dailyReasonsFor(base({ decisionNeeded: 'reprecio', lastDecisionChangeAt: daysAgo(6) }), null, NOW);
    expect(r.map(x => x.kind)).toEqual(['decision']);
    expect(r[0].detail).toBe('Re-precio pendiente hace 6 días');
  });

  test('"ninguna" no es una decisión pendiente', () => {
    expect(kinds(base({ decisionNeeded: 'ninguna' }))).toEqual([]);
    expect(kinds(base({ decisionNeeded: null }))).toEqual([]);
  });

  test('más de 2 días sin update es "silencio" y muestra la última acción', () => {
    const r = dailyReasonsFor(base({ lastUpdateAt: daysAgo(8), updatedAt: daysAgo(8), currentAction: '¿Ya están andando?' }), null, NOW);
    expect(r.map(x => x.kind)).toEqual(['silencio']);
    expect(r[0].detail).toBe('Sin novedades hace 8 días · última: "¿Ya están andando?"');
  });

  test('el silencio de la daily es más corto que el "sin update" de la lista', () => {
    expect(kinds(base({ lastUpdateAt: daysAgo(2), updatedAt: daysAgo(2) }))).toEqual([]);
    expect(kinds(base({ lastUpdateAt: daysAgo(3), updatedAt: daysAgo(3) }))).toEqual(['silencio']);
    // 3 días es silencio para la daily pero todavía no "sin update" en la lista
    expect(isStale(daysAgo(3), NOW)).toBe(false);
  });

  test('"todo igual" sin escribir no calla el silencio: sin update nuevo, mañana vuelve', () => {
    const item = base({ lastUpdateAt: daysAgo(4), updatedAt: hoursAgo(1) }); // updatedAt tocado por la daily de hoy
    expect(kinds(item, new Date(hoursAgo(1)))).toEqual(['silencio']);
  });

  test('el silencio se mide por el último update real, no por updatedAt del review', () => {
    // updatedAt cambia con cualquier PATCH (ej. owner), pero el último update escrito es viejo
    expect(kinds(base({ updatedAt: hoursAgo(1), lastUpdateAt: daysAgo(9) }))).toEqual(['silencio']);
  });

  test('escribir un update saca al ítem del silencio', () => {
    expect(kinds(base({ updatedAt: hoursAgo(1), lastUpdateAt: hoursAgo(1) }))).toEqual([]);
  });

  test('un ítem que nunca tuvo update es silencio', () => {
    const r = dailyReasonsFor(base({ updatedAt: null, lastUpdateAt: null }), null, NOW);
    expect(r[0].kind).toBe('silencio');
    expect(r[0].detail).toBe('Nunca tuvo un update');
  });

  test('ítem custom recién creado sin otras razones entra como "nuevo"', () => {
    expect(kinds(base({ isCustom: true, createdAt: hoursAgo(5), updatedAt: hoursAgo(5), lastUpdateAt: hoursAgo(5) }))).toEqual(['nuevo']);
  });

  test('los proyectos (no custom) nunca son "nuevo"', () => {
    expect(kinds(base({ isCustom: false, createdAt: hoursAgo(5) }))).toEqual([]);
  });
});

describe('dailyReasonsFor — orden y combinación', () => {
  test('varias razones se ordenan por prioridad (rojo > vence > decisión > silencio)', () => {
    const item = base({
      healthStatus: 'rojo',
      deadline: inDays(1),
      decisionNeeded: 'recursos',
      lastUpdateAt: daysAgo(10), updatedAt: daysAgo(10),
    });
    const r = kinds(item);
    expect(r).toEqual(['rojo', 'vence', 'decision', 'silencio']);
    // y respeta DAILY_REASON_ORDER
    const idx = r.map(k => DAILY_REASON_ORDER.indexOf(k));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });
});

describe('helpers', () => {
  test('daysUntil ignora la hora del día', () => {
    expect(daysUntil(new Date('2026-09-10T02:00:00').toISOString(), NOW)).toBe(1);
    expect(daysUntil(new Date('2026-09-09T23:59:00').toISOString(), NOW)).toBe(0);
    expect(daysUntil(null, NOW)).toBeNull();
  });

  test('isStale usa el umbral de 5 días', () => {
    expect(isStale(daysAgo(4), NOW)).toBe(false);
    expect(isStale(daysAgo(6), NOW)).toBe(true);
    expect(isStale(null, NOW)).toBe(true);
  });

  test('formatDuration', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(60)).toBe('1 min');
    expect(formatDuration(340)).toBe('5 min 40 s');
  });
});
