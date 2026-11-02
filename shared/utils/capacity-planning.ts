import { z } from "zod";
import { isValidCivilDate } from "./task-civil-date";

export const capacityModeSchema = z.enum(["task", "section", "project"]);
export type CapacityMode = z.infer<typeof capacityModeSchema>;
export const capacityWeekSchema = z.string().refine(value => {
  if (!isValidCivilDate(value)) return false;
  return new Date(`${value}T12:00:00Z`).getUTCDay() === 1;
}, "Seleccioná el lunes de una semana válida");
export const capacityGroupSchema = z.object({
  projectId: z.number().int().positive(), personnelId: z.number().int().positive(),
  weekStart: capacityWeekSchema, scope: z.enum(["section", "project"]),
  sectionName: z.string().trim().max(250).default(""),
  estimatedHours: z.number().finite().min(0).max(10000),
}).strict().refine(value => value.scope === "project" ? value.sectionName === "" : value.sectionName.length > 0,
  "Elegí una sección para la estimación por sección");

export type CapacityTask = { id: number; projectId: number; personnelId: number; title: string; sectionName: string | null; estimatedHours: number; isExtra: boolean };
export type CapacityGroup = { projectId: number; personnelId: number; scope: "section" | "project"; sectionName: string; estimatedHours: number };
export type CapacityProject = { id: number; name: string; clientName: string; mode: CapacityMode; sectionNames: string[]; memberIds: number[] };
export type CapacityPlanning = { projects: CapacityProject[]; tasks: CapacityTask[]; groups: CapacityGroup[] };

export function capacityProjectHours(mode: CapacityMode, tasks: CapacityTask[], groups: CapacityGroup[]): number {
  const taskHours = tasks.filter(task => mode === "task" || task.isExtra).reduce((sum, task) => sum + task.estimatedHours, 0);
  return Math.round((taskHours + groups.filter(group => group.scope === mode).reduce((sum, group) => sum + group.estimatedHours, 0)) * 100) / 100;
}
