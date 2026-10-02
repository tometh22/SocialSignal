/** Rebuild section rows once from a flat task response, retaining empty sections. */
export function groupTasksBySection<T extends { sectionName?: string | null }>(tasks: T[], names: string[]): Record<string, T[]> {
  const sections: Record<string, T[]> = Object.create(null);
  for (const name of names) sections[name] = [];
  for (const task of tasks) {
    const name = task.sectionName || "General";
    (sections[name] ??= []).push(task);
  }
  return sections;
}
