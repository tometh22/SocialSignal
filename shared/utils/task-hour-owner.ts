/** New hours follow the task owner; historical entries keep their original person. */
export function taskHourOwner(task: { assigneeId?: number | null }, parent?: { assigneeId?: number | null } | null): number | null {
  return task.assigneeId ?? parent?.assigneeId ?? null;
}

export function taskHourAttribution(ownerId: number | null, actorPersonnelId: number | null, canLogForOthers: boolean, requestedId?: unknown):
  { personnelId: number } | { status: number; message: string } {
  if (!ownerId) return { status: 400, message: "Asigná un responsable a la tarea antes de registrar horas." };
  if (!canLogForOthers && actorPersonnelId !== ownerId) {
    return { status: 403, message: "Las horas corresponden al responsable de la tarea. Solo quien gestiona tareas puede cargarlas para otra persona." };
  }
  if (requestedId != null && requestedId !== "" && Number(requestedId) !== ownerId) {
    return { status: 409, message: "El responsable de la tarea cambió o no coincide con la carga. Actualizá la tarea antes de guardar." };
  }
  return { personnelId: ownerId };
}
