// Roles de un miembro dentro de un proyecto (módulo de gestión de tareas).
// El campo role en task_project_members es texto libre; estos son los valores canónicos.
export const PROJECT_ROLE_OPTIONS = [
  { value: "owner",    label: "Responsable" },
  { value: "pm",       label: "PM" },
  { value: "analyst",  label: "Analista" },
  { value: "datatech", label: "Datatech" },
  { value: "setup",    label: "SetUp" },
  { value: "member",   label: "Miembro" },
] as const;

export const PROJECT_ROLE_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_ROLE_OPTIONS.map((r) => [r.value, r.label])
);

export function projectRoleLabel(role: string | null | undefined): string {
  if (!role) return "Miembro";
  return PROJECT_ROLE_LABELS[role] ?? role;
}
