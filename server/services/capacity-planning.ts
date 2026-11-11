import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { activeProjects, capacityGroupEstimates, taskProjectMembers, taskWeeklyEstimates, tasks } from "@shared/schema";
import { capacityGroupSchema, capacityModeSchema, capacityWeekSchema, type CapacityGroup, type CapacityPlanning, type CapacityProject, type CapacityTask } from "@shared/utils/capacity-planning";
import type { EstimateRange } from "@shared/utils/taskEstimates";

export type CapacityActor = { userId: number; personnelId: number | null; isOperations: boolean };
function fail(message: string, status = 403): never { throw Object.assign(new Error(message), { status }); }

export function effectiveCapacityEstimatesQuery(range: EstimateRange = {}) {
  return sql`SELECT project_id AS "projectId", personnel_id AS "personnelId", week_start AS "weekStart",
    estimated_hours AS "estimatedHours", section_name AS "sectionName", task_id AS "taskId"
    FROM capacity_effective_weekly_estimates
    WHERE (${range.dateFrom ?? null}::text IS NULL OR week_start::date + 6 >= ${range.dateFrom ?? null}::date)
      AND (${range.dateTo ?? null}::text IS NULL OR week_start::date <= ${range.dateTo ?? null}::date)`;
}

export async function loadCapacityPlanning(weekStart: string, actor: CapacityActor): Promise<CapacityPlanning> {
  capacityWeekSchema.parse(weekStart);
  const result = await db.execute(sql`SELECT p.id, COALESCE(p.name, q.project_name, 'Proyecto') AS name,
    c.name AS "clientName", COALESCE(wm.mode,p.capacity_estimation_mode) AS mode, p.task_section_names AS "sectionNames",
    ARRAY(SELECT m.personnel_id FROM task_project_members m WHERE m.project_id=p.id) AS "memberIds"
    FROM active_projects p LEFT JOIN quotations q ON q.id=p.quotation_id LEFT JOIN clients c ON c.id=p.client_id
    LEFT JOIN capacity_week_modes wm ON wm.project_id=p.id AND wm.week_start=${weekStart}
    WHERE p.status='active' AND (${actor.isOperations} OR EXISTS(SELECT 1 FROM task_project_members m WHERE m.project_id=p.id AND m.personnel_id=${actor.personnelId}))
    ORDER BY c.name, name, p.id`);
  const projects = result.rows as CapacityProject[];
  if (!projects.length) return { projects: [], tasks: [], groups: [] };
  const projectIds = projects.map(project => project.id);
  const [taskResult, groupResult] = await Promise.all([
    db.execute(sql`SELECT t.id, t.project_id AS "projectId", t.assignee_id AS "personnelId", t.title, t.status,
      t.section_name AS "sectionName", COALESCE(e.estimated_hours,0)::float8 AS "estimatedHours", COALESCE(e.is_extra,false) AS "isExtra"
      FROM tasks t LEFT JOIN task_weekly_estimates e ON e.task_id=t.id AND e.week_start=${weekStart}
      WHERE t.project_id=ANY(${sql.param(projectIds)}::int[]) AND t.assignee_id IS NOT NULL AND t.status <> 'cancelled' AND (t.status <> 'done' OR e.id IS NOT NULL)
        AND (${actor.isOperations} OR t.assignee_id=${actor.personnelId})
        AND (e.id IS NOT NULL OR (t.start_date IS NULL AND t.due_date IS NULL)
          OR (COALESCE(t.start_date,t.due_date)::date <= ${weekStart}::date+6 AND COALESCE(t.due_date,t.start_date)::date >= ${weekStart}::date))
      ORDER BY t.section_name, t.title, t.id`),
    db.execute(sql`SELECT project_id AS "projectId", personnel_id AS "personnelId", scope, section_name AS "sectionName", estimated_hours AS "estimatedHours"
      FROM capacity_group_estimates WHERE project_id=ANY(${sql.param(projectIds)}::int[]) AND week_start=${weekStart}
      AND (${actor.isOperations} OR personnel_id=${actor.personnelId})`),
  ]);
  return { projects, tasks: taskResult.rows as CapacityTask[], groups: groupResult.rows as CapacityGroup[] };
}

async function lockProject(tx: any, projectId: number, actor: CapacityActor, personnelId?: number) {
  const [project] = await tx.select().from(activeProjects).where(eq(activeProjects.id, projectId)).for("update");
  if (!project || project.status !== "active") fail("El proyecto no está activo", 409);
  const members = await tx.select().from(taskProjectMembers).where(eq(taskProjectMembers.projectId, projectId));
  if (!actor.isOperations && (!actor.personnelId || !members.some((member: any) => member.personnelId === actor.personnelId))) fail("No tenés acceso a este proyecto");
  if (personnelId != null) {
    if (!actor.isOperations && personnelId !== actor.personnelId) fail("Sólo podés modificar tus propias estimaciones");
    if (!members.some((member: any) => member.personnelId === personnelId)) fail("La persona debe ser miembro del proyecto", 400);
  }
  return project;
}

export async function saveCapacityMode(projectId: number, modeInput: unknown, actor: CapacityActor, weekStart: string) {
  if (!actor.isOperations) fail("La modalidad de estimación corresponde a Operaciones");
  const mode = capacityModeSchema.parse(modeInput);
  capacityWeekSchema.parse(weekStart);
  await db.transaction(async tx => {
    await lockProject(tx, projectId, actor);
    await tx.execute(sql`INSERT INTO capacity_week_modes(project_id,week_start,mode) VALUES(${projectId},${weekStart},${mode})
      ON CONFLICT(project_id,week_start) DO UPDATE SET mode=EXCLUDED.mode`);
  });
}

export async function saveCapacityGroup(input: unknown, actor: CapacityActor) {
  const value = capacityGroupSchema.parse(input);
  return db.transaction(async tx => {
    const project = await lockProject(tx, value.projectId, actor, value.personnelId);
    const modes = await tx.execute(sql`SELECT mode FROM capacity_week_modes WHERE project_id=${value.projectId} AND week_start=${value.weekStart}`);
    if ((modes.rows[0]?.mode ?? project.capacityEstimationMode) !== value.scope) fail("La modalidad cambió. Actualizá la pantalla", 409);
    if (value.scope === "section" && value.estimatedHours > 0) {
      const rows = await tx.select({ name: tasks.sectionName }).from(tasks).where(eq(tasks.projectId, value.projectId));
      const names = new Set([...(project.taskSectionNames ?? []), ...rows.map(row => row.name || "General")]);
      if (!names.has(value.sectionName)) fail("La sección no pertenece al proyecto", 400);
    }
    const key = and(eq(capacityGroupEstimates.projectId, value.projectId), eq(capacityGroupEstimates.personnelId, value.personnelId),
      eq(capacityGroupEstimates.weekStart, value.weekStart), eq(capacityGroupEstimates.scope, value.scope), eq(capacityGroupEstimates.sectionName, value.sectionName));
    if (value.estimatedHours === 0) { await tx.delete(capacityGroupEstimates).where(key); return; }
    await tx.insert(capacityGroupEstimates).values({ ...value, updatedBy: actor.userId }).onConflictDoUpdate({
      target: [capacityGroupEstimates.projectId, capacityGroupEstimates.personnelId, capacityGroupEstimates.weekStart, capacityGroupEstimates.scope, capacityGroupEstimates.sectionName],
      set: { estimatedHours: value.estimatedHours, updatedBy: actor.userId, updatedAt: new Date() },
    });
  });
}

export async function saveCapacityExtra(taskId: number, weekStart: string, isExtra: boolean, actor: CapacityActor) {
  capacityWeekSchema.parse(weekStart);
  await db.transaction(async tx => {
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task?.projectId || !task.assigneeId) fail("La tarea debe tener proyecto y responsable", 400);
    await lockProject(tx, task.projectId, actor, task.assigneeId);
    const [current] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).for("update");
    if (!current || current.projectId !== task.projectId || current.assigneeId !== task.assigneeId) fail("La tarea cambió. Actualizá la pantalla", 409);
    const [saved] = await tx.update(taskWeeklyEstimates).set({ isExtra }).where(and(eq(taskWeeklyEstimates.taskId, taskId), eq(taskWeeklyEstimates.weekStart, weekStart))).returning();
    if (!saved) fail("Cargá primero las horas estimadas de la tarea", 409);
  });
}

export async function moveCapacitySectionEstimates(tx: any, projectId: number, oldName: string, newName: string) {
  if (oldName === newName) return;
  await tx.execute(sql`INSERT INTO capacity_group_estimates(project_id,personnel_id,week_start,scope,section_name,estimated_hours,updated_by)
    SELECT project_id,personnel_id,week_start,scope,${newName},estimated_hours,updated_by
    FROM capacity_group_estimates WHERE project_id=${projectId} AND scope='section' AND section_name=${oldName}
    ON CONFLICT(project_id,personnel_id,week_start,scope,section_name) DO UPDATE
    SET estimated_hours=capacity_group_estimates.estimated_hours+EXCLUDED.estimated_hours,updated_at=now()`);
  await tx.delete(capacityGroupEstimates).where(and(eq(capacityGroupEstimates.projectId, projectId), eq(capacityGroupEstimates.scope, "section"), eq(capacityGroupEstimates.sectionName, oldName)));
}
