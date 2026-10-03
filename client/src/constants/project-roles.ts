import { TASK_PROJECT_ROLES } from "@shared/task-project-roles";
// Roles de un miembro dentro de un proyecto (módulo de gestión de tareas).
// El campo role en task_project_members es texto libre; estos son los valores canónicos.
const ROLE_LABELS: Record<(typeof TASK_PROJECT_ROLES)[number], string> = {
  owner: "Responsable", pm: "PM", analyst: "Analista", datatech: "Datatech", setup: "SetUp", member: "Miembro",
};
export const PROJECT_ROLE_OPTIONS = TASK_PROJECT_ROLES.map(value => ({ value, label: ROLE_LABELS[value] }));

export const PROJECT_ROLE_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_ROLE_OPTIONS.map((r) => [r.value, r.label])
);

export function projectRoleLabel(role: string | null | undefined): string {
  if (!role) return "Miembro";
  return PROJECT_ROLE_LABELS[role] ?? role;
}
