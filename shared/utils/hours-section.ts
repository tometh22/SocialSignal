import { reconcileHourSources, type HourRecord } from "./hours-reconciliation";

export type SectionTask = { id: number; projectId: number | null; sectionName?: string | null };

// Prefix names to keep real sections called "all" or "unsectioned" selectable.
export function hoursSectionKey(name: string | null | undefined): string {
  return name?.trim() ? `named:${name}` : "unsectioned";
}

export function validHoursSection(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string" && (value === "unsectioned" || value.startsWith("named:") && value.slice(6).trim().length > 0 && value.length <= 256);
}

export function filterHoursTasks<T extends SectionTask>(tasks: T[], projectId: number | null, section?: string): T[] {
  return tasks.filter(task => (!projectId || task.projectId === projectId) && (!section || hoursSectionKey(task.sectionName) === section));
}

export function hoursSectionOptions(tasks: SectionTask[]): Array<{ value: string; label: string }> {
  return [...new Set(tasks.map(task => hoursSectionKey(task.sectionName)))]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map(value => ({ value, label: value === "unsectioned" ? "Sin sección (incluye registros históricos)" : value.slice(6) }));
}


/** Prefer a task's section on matched imports; unmatched legacy time has no section. */
export function reconcileSectionHours<T extends HourRecord & { sectionName?: string | null }, L extends HourRecord & { sectionName?: string | null }>(task: T[], legacy: L[], section?: string): Array<T | L> {
  const entries = section ? reconcileHourSources(legacy, task) : reconcileHourSources(task, legacy);
  return entries.filter(entry => !section || hoursSectionKey(entry.sectionName) === section)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
