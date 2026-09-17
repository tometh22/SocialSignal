import type { Objective } from "@/lib/objectives-api";
import {
  areaGroupOf,
  FRONT_ORDER,
  FRONTS,
  frontOf,
  CHECKPOINTS,
  MONTH_CHECKPOINT_SLUGS,
  planRoleOf,
  NORTH_STAR,
  NORTH_STAR_SUPPORT,
  tierFor,
  type FrontId,
  type PlanRole,
  type Tier,
} from "@shared/objectives-fronts";

export type ObjectiveNode = {
  objective: Objective;
  children: ObjectiveNode[];
  depth: number;
  /** Cuántos objetivos cuelgan debajo, a cualquier profundidad. */
  descendants: number;
};

export type Deadline = {
  date: string;
  daysLeft: number;
  /** Ya pasó la fecha de corte. */
  overdue: boolean;
  /** Vence dentro de los próximos 14 días. */
  soon: boolean;
};

const DAY = 24 * 60 * 60 * 1000;

export function todayISO(now: Date = new Date()): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function deadlineOf(objective: Objective, today = todayISO()): Deadline | null {
  const raw = objective.targetDate ? String(objective.targetDate).slice(0, 10) : null;
  if (!raw) return null;
  const daysLeft = Math.round((Date.parse(`${raw}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  if (!Number.isFinite(daysLeft)) return null;
  return { date: raw, daysLeft, overdue: daysLeft < 0, soon: daysLeft >= 0 && daysLeft <= 14 };
}

function isDone(objective: Objective): boolean {
  const status = String(objective.status ?? "").toLowerCase();
  return ["done", "completed", "complete", "closed", "logrado", "cerrada", "completada"].includes(status);
}

/**
 * Orden de atención, no una prioridad que alguien tenga que mantener a mano:
 * primero lo vencido, después lo que vence antes, después lo que no tiene
 * fecha, y al final lo continuo —que no vence— y lo ya logrado.
 */
export function priorityRank(objective: Objective, today = todayISO()): number {
  if (isDone(objective)) return 5;
  if (objective.targetKind === "continuous") return 4;
  const deadline = deadlineOf(objective, today);
  if (!deadline) return 3;
  if (deadline.overdue) return 0;
  if (deadline.soon) return 1;
  return 2;
}

function tierRank(objective: Objective, today: string): number {
  return tierFor(objective.slug, today) === "innegociable" ? 0 : 1;
}

/**
 * La prioridad se declara, no se cuenta: manda el tier que el plan fijó para
 * el mes, y recién después la fecha. "Cuánto cuelga" queda como dato.
 */
function compare(a: Objective, b: Objective, today: string): number {
  const tier = tierRank(a, today) - tierRank(b, today);
  if (tier !== 0) return tier;
  const rank = priorityRank(a, today) - priorityRank(b, today);
  if (rank !== 0) return rank;
  const da = deadlineOf(a, today)?.date ?? "9999-12-31";
  const db = deadlineOf(b, today)?.date ?? "9999-12-31";
  if (da !== db) return da < db ? -1 : 1;
  return String(a.title).localeCompare(String(b.title), "es");
}

/**
 * Arma el árbol a partir de parentObjectiveId. Un objetivo cuyo padre no está
 * en la lista (por ejemplo si se filtró) se trata como raíz, para que ningún
 * objetivo desaparezca de la pantalla por culpa del filtro.
 */
export function buildObjectiveTree(objectives: Objective[], today = todayISO()): ObjectiveNode[] {
  const byId = new Map<string, Objective>();
  for (const objective of objectives) byId.set(String(objective.id), objective);

  const childrenOf = new Map<string, Objective[]>();
  const roots: Objective[] = [];
  for (const objective of objectives) {
    const parentId = objective.parentObjectiveId != null ? String(objective.parentObjectiveId) : null;
    if (parentId && byId.has(parentId) && parentId !== String(objective.id)) {
      childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), objective]);
    } else {
      roots.push(objective);
    }
  }

  // Un ciclo cerrado (1 → 2 → 1) no deja ninguna raíz, y sin esto los dos
  // objetivos desaparecerían de la pantalla en vez de mostrarse mal. Todo lo
  // que no se alcanza desde una raíz se promueve a raíz.
  const reachable = new Set<string>();
  const markReachable = (objective: Objective) => {
    const id = String(objective.id);
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const child of childrenOf.get(id) ?? []) markReachable(child);
  };
  for (const root of roots) markReachable(root);
  for (const objective of objectives) {
    if (!reachable.has(String(objective.id))) {
      roots.push(objective);
      markReachable(objective);
    }
  }

  const seen = new Set<string>();
  const build = (objective: Objective, depth: number): ObjectiveNode => {
    const id = String(objective.id);
    // Un ciclo en los datos colgaría la pantalla; cortarlo es preferible.
    if (seen.has(id)) return { objective, children: [], depth, descendants: 0 };
    seen.add(id);
    const children = [...(childrenOf.get(id) ?? [])]
      .sort((a, b) => compare(a, b, today))
      .map((child) => build(child, depth + 1));
    return {
      objective,
      children,
      depth,
      descendants: children.reduce((total, child) => total + 1 + child.descendants, 0),
    };
  };

  return roots.sort((a, b) => compare(a, b, today)).map((objective) => build(objective, 0));
}

export function flattenTree(nodes: ObjectiveNode[], expanded: Set<string>): ObjectiveNode[] {
  const out: ObjectiveNode[] = [];
  const walk = (list: ObjectiveNode[]) => {
    for (const node of list) {
      out.push(node);
      if (expanded.has(String(node.objective.id))) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

/** Ids de todos los objetivos del árbol, para "expandir todo". */
export function allNodeIds(nodes: ObjectiveNode[]): string[] {
  const out: string[] = [];
  const walk = (list: ObjectiveNode[]) => {
    for (const node of list) {
      if (node.children.length) out.push(String(node.objective.id));
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

export function formatDeadline(deadline: Deadline): string {
  if (deadline.overdue) {
    const days = Math.abs(deadline.daysLeft);
    return days === 1 ? "Venció ayer" : `Venció hace ${days} días`;
  }
  if (deadline.daysLeft === 0) return "Vence hoy";
  if (deadline.daysLeft === 1) return "Vence mañana";
  return `Vence en ${deadline.daysLeft} días`;
}

// ── Frentes ────────────────────────────────────────────────────────────────
// Encima del árbol de parentesco: un norte y cinco frentes, con un nodo de
// área entre el objetivo de empresa y sus objetivos de área. El primer nivel
// pasa de 23 nodos a 1 + 5.

// Octubre y diciembre no escriben la fecha en su meta; el mes igual tiene que
// caer en la línea de tiempo, así que se ancla al último día del mes.
const MONTH_CHECKPOINT_DATES: Record<string, string> = {
  "company-month-sep-open-mesas": "2026-09-30",
  "company-month-oct-advance": "2026-10-31",
  "company-month-nov-close": "2026-11-30",
  "company-month-dec-renew": "2026-12-31",
};

export type GroupNode = {
  kind: "group";
  id: string;
  label: string;
  children: ObjectiveNode[];
  descendants: number;
};

export type TreeItem = ObjectiveNode | GroupNode;

export function isGroup(item: TreeItem): item is GroupNode {
  return (item as GroupNode).kind === "group";
}

export type FrontSummary = {
  id: FrontId;
  label: string;
  /** Objetivos de empresa del frente, ya con su descendencia. */
  objectives: ObjectiveNode[];
  /** Entradas del plan bajo el frente, incluida la bajada. */
  total: number;
  /** Objetivos de empresa del frente: el número que importa. */
  objectives_: number;
  /** Estándares que cuelgan del frente. No son objetivos: no se cuentan como tales. */
  standards_: number;
  overdue: number;
  dueSoon: number;
  nonNegotiable: number;
  /** Promedio de avance sobre los objetivos que tienen avance cargado. */
  progress: number | null;
};

export type ObjectivesMap = {
  northStar: ObjectiveNode | null;
  northSupport: ObjectiveNode[];
  fronts: FrontSummary[];
  /** Estándares sostenidos: no vencen, se miden por cumplimiento. */
  standards: Objective[];
  /** Objetivos de mes: puntos de control, fuera del árbol. */
  checkpoints: Objective[];
  /** Lo que vence en los próximos 14 días, sin contar puntos de control. */
  dueSoon: Objective[];
  /** Estándares medidos y por debajo del umbral: el semáforo en rojo. */
  standardsBreached: Objective[];
  /** Estándares que nadie midió todavía: gris, no rojo. No es lo mismo. */
  standardsUnmeasured: Objective[];
  /** Marcadores de la línea de tiempo, en orden. */
  timeline: Array<{ date: string; label: string; hard: boolean; objective: Objective | null }>;
  /** Objetivos de empresa que no están en ningún frente: hay que clasificarlos. */
  unplaced: Objective[];
  /** Cuántas entradas del plan son realmente un objetivo, y cuántas otra cosa. */
  counts: Record<PlanRole, number>;
};

function countDeep(node: ObjectiveNode, today: string, seen = { total: 0, overdue: 0, dueSoon: 0, nonNegotiable: 0, sum: 0, withProgress: 0 }) {
  const stack: ObjectiveNode[] = [node];
  while (stack.length) {
    const current = stack.pop()!;
    seen.total += 1;
    const deadline = deadlineOf(current.objective, today);
    if (deadline?.overdue) seen.overdue += 1;
    else if (deadline?.soon) seen.dueSoon += 1;
    if (tierFor(current.objective.slug, today) === "innegociable") seen.nonNegotiable += 1;
    const progress = current.objective.progressPercent;
    if (typeof progress === "number" && Number.isFinite(progress)) {
      seen.sum += Math.max(0, Math.min(100, progress));
      seen.withProgress += 1;
    }
    stack.push(...current.children);
  }
  return seen;
}

/**
 * Inserta un nodo de área entre un objetivo de empresa y sus hijos de área.
 * Los hijos de persona que cuelgan directo de empresa (CEO y COO) se quedan
 * donde están: no pertenecen a un área.
 */
function groupAreaChildren(node: ObjectiveNode): TreeItem[] {
  const groups = new Map<string, { label: string; children: ObjectiveNode[] }>();
  const loose: ObjectiveNode[] = [];
  for (const child of node.children) {
    const group = areaGroupOf(child.objective.slug);
    if (group && child.objective.level === "area") {
      const bucket = groups.get(group.id) ?? { label: group.label, children: [] };
      bucket.children.push(child);
      groups.set(group.id, bucket);
    } else {
      loose.push(child);
    }
  }
  const grouped: TreeItem[] = [...groups.entries()].map(([id, bucket]) => ({
    kind: "group" as const,
    id: `${String(node.objective.id)}:${id}`,
    label: bucket.label,
    children: bucket.children,
    descendants: bucket.children.reduce((total, child) => total + 1 + child.descendants, 0),
  }));
  // Un solo grupo no aporta nada: sería un nodo con un único hijo.
  if (grouped.length <= 1) return [...(grouped[0] ? (grouped[0] as GroupNode).children : []), ...loose];
  return [...grouped, ...loose];
}

export function childrenOfNode(node: ObjectiveNode): TreeItem[] {
  return node.depth === 0 ? groupAreaChildren(node) : node.children;
}

export function buildObjectivesMap(objectives: Objective[], today = todayISO()): ObjectivesMap {
  const checkpointSlugs = new Set(MONTH_CHECKPOINT_SLUGS);
  const supportSlugs = new Set(NORTH_STAR_SUPPORT);

  const checkpoints = objectives.filter((o) => o.slug && checkpointSlugs.has(o.slug));
  const standards = objectives.filter((o) => o.targetKind === "continuous" && !checkpointSlugs.has(String(o.slug)));

  // El árbol se arma sobre todo menos los puntos de control, que no sostienen
  // nada. Los estándares sí quedan en el árbol: cuelgan de un frente y además
  // se listan aparte.
  const tree = buildObjectiveTree(objectives.filter((o) => !(o.slug && checkpointSlugs.has(o.slug))), today);
  const rootBySlug = new Map(tree.map((node) => [String(node.objective.slug ?? ""), node]));

  const northStar = rootBySlug.get(NORTH_STAR) ?? null;
  const northSupport = tree.filter((node) => node.objective.slug && supportSlugs.has(node.objective.slug));

  const placed = new Set<ObjectiveNode>();
  if (northStar) placed.add(northStar);
  for (const node of northSupport) placed.add(node);

  const fronts: FrontSummary[] = FRONT_ORDER.map((id) => {
    const nodes = tree.filter((node) => frontOf(node.objective.slug) === id);
    for (const node of nodes) placed.add(node);
    const stats = nodes.reduce(
      (acc, node) => {
        const counted = countDeep(node, today);
        return {
          total: acc.total + counted.total,
          overdue: acc.overdue + counted.overdue,
          dueSoon: acc.dueSoon + counted.dueSoon,
          nonNegotiable: acc.nonNegotiable + counted.nonNegotiable,
          sum: acc.sum + counted.sum,
          withProgress: acc.withProgress + counted.withProgress,
        };
      },
      { total: 0, overdue: 0, dueSoon: 0, nonNegotiable: 0, sum: 0, withProgress: 0 },
    );
    return {
      id,
      label: FRONTS[id],
      objectives: nodes,
      total: stats.total,
      objectives_: nodes.filter((node) => planRoleOf(node.objective.slug, node.objective.level, node.objective.targetKind) === "objetivo").length,
      standards_: nodes.filter((node) => planRoleOf(node.objective.slug, node.objective.level, node.objective.targetKind) === "estandar").length,
      overdue: stats.overdue,
      dueSoon: stats.dueSoon,
      nonNegotiable: stats.nonNegotiable,
      progress: stats.withProgress ? Math.round(stats.sum / stats.withProgress) : null,
    };
  });

  // Si mañana aparece un objetivo de empresa sin frente, tiene que verse, no
  // desaparecer. Pero una rama que quedó sin padre —porque un filtro lo dejó
  // fuera— no está "sin clasificar": sólo perdió a su raíz. Confundir las dos
  // cosas llenaba la pantalla de falsos positivos.
  const unplaced = tree
    .filter((node) => !placed.has(node) && node.objective.level === "company")
    .map((node) => node.objective);

  const counts: Record<PlanRole, number> = { objetivo: 0, bajada: 0, estandar: 0, checkpoint: 0 };
  for (const objective of objectives) {
    counts[planRoleOf(objective.slug, objective.level, objective.targetKind)] += 1;
  }

  const inTree = objectives.filter((o) => !(o.slug && checkpointSlugs.has(o.slug)));
  const dueSoon = dueWithin(inTree, 14, today);

  // "Nadie lo midió" y "se está incumpliendo" son cosas distintas, y pintarlas
  // del mismo color convierte el semáforo en ruido: hoy los 19 estándares
  // están sin medir, así que todo aparecía en rojo sin que nada esté mal.
  const isMeasured = (objective: Objective) =>
    typeof objective.progressPercent === "number" && Number.isFinite(objective.progressPercent);
  const standardsUnmeasured = standards.filter((objective) => !isMeasured(objective));
  const standardsBreached = standards.filter(
    (objective) => isMeasured(objective) && Number(objective.progressPercent) < 100,
  );

  const checkpointBySlug = new Map(checkpoints.map((o) => [String(o.slug), o]));
  const timeline = [
    ...MONTH_CHECKPOINT_SLUGS.map((slug) => {
      const objective = checkpointBySlug.get(slug) ?? null;
      return {
        date: objective?.targetDate ? String(objective.targetDate).slice(0, 10) : MONTH_CHECKPOINT_DATES[slug] ?? "",
        label: objective?.title ?? slug,
        hard: false,
        objective,
      };
    }),
    ...CHECKPOINTS.map((checkpoint) => ({ ...checkpoint, objective: null })),
  ]
    .filter((entry) => entry.date)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return { northStar, northSupport, fronts, standards, standardsBreached, standardsUnmeasured, checkpoints, dueSoon, timeline, unplaced, counts };
}

/** Objetivos que vencen dentro de la ventana, ordenados por urgencia. */
export function dueWithin(objectives: Objective[], days: number, today = todayISO()): Objective[] {
  return objectives
    .filter((objective) => {
      const deadline = deadlineOf(objective, today);
      return deadline != null && deadline.daysLeft <= days;
    })
    .sort((a, b) => compare(a, b, today));
}

export function tierOf(objective: Objective, today = todayISO()): Tier {
  return tierFor(objective.slug, today);
}
