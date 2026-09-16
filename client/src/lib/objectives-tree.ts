import type { Objective } from "@/lib/objectives-api";

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

function compare(a: Objective, b: Objective, today: string): number {
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
