// React Query prefix matching stops at array elements: ['/api/tasks'] does
// not invalidate ['/api/tasks/project']. Keep every task surface in sync.
export function isTaskRelatedQuery(key: readonly unknown[]): boolean {
  const first = String(key[0] ?? "");
  return first === "/api/tasks" || first.startsWith("/api/tasks/") || first === "/api/tasks-projects"
    || first === "/api/projects" || first.startsWith("/api/projects/") || first === "projects"
    || first.startsWith("/api/quotations") || first === "/api/capacity/weekly"
    || first === "/api/monthly-closings/real-hours";
}
