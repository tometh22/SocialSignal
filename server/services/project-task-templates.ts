import { z } from "zod";
import sourceTemplates from "../content/asana-project-templates.json";
import type { ProjectTaskTemplate, ProjectTemplateTask } from "../../shared/project-task-template";

export const projectTemplateKeySchema = z.enum(["none", "recurring", "weekly", "monthly", "one_shot"]);
export const projectTaskTemplates = sourceTemplates as ProjectTaskTemplate[];

export function findProjectTaskTemplate(key: z.infer<typeof projectTemplateKeySchema>): ProjectTaskTemplate | null {
  if (key === "none") return null;
  const canonicalKey = key === "weekly" || key === "monthly" ? "recurring" : key;
  const template = projectTaskTemplates.find(item => item.key === canonicalKey);
  if (!template) throw new Error("Plantilla de proyecto no disponible");
  return template;
}

// A template starts a new workflow. Owners, dates, completion, logged hours and
// costs are chosen for that project rather than copied from the source account.
export function templateTaskValues(task: ProjectTemplateTask, projectId: number, sectionName: string, position: number, createdBy: number | null, parentTaskId: number | null = null) {
  return {
    title: task.title, description: task.description, isMilestone: task.isMilestone,
    projectId, sectionName, position, createdBy, parentTaskId,
    status: "todo", priority: "medium", assigneeId: null, collaboratorIds: [],
    startDate: null, dueDate: null, estimatedHours: null, loggedHours: 0, completedAt: null,
    recurrenceRule: null, recurrenceSourceTaskId: null,
  };
}
