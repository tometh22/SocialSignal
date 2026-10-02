import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { countTemplateTasks } from "../shared/project-task-template";
import { findProjectTaskTemplate, projectTaskTemplates, projectTemplateKeySchema, templateTaskValues } from "../server/services/project-task-templates";
import { insertTaskSchema } from "../shared/schema";
import { taskMilestonesMigrationSql } from "../server/migrations/task-milestones";

describe("Original Asana project templates", () => {
  it("records the two original projects and source fingerprints", () => {
    expect(projectTaskTemplates.map(item => item.sourceProjectId)).toEqual(["1209514037888454", "1209514033286527"]);
    for (const template of projectTaskTemplates) {
      expect(template.sourceUrl).toContain(`/project/${template.sourceProjectId}/`);
      expect(template.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(template.capturedOn).toBe("2026-10-02");
    }
  });
  it("preserves all 22 recurring tasks in five ordered sections", () => {
    const template = findProjectTaskTemplate("recurring")!;
    expect(countTemplateTasks(template)).toBe(22);
    expect(template.sections.map(section => [section.name, section.tasks.length])).toEqual([
      ["Sección sin nombre", 1], ["Kick off incial", 11], ["Informes tareas generales y mejoras", 1], ["Informe MesXXXX", 8], ["Alertas", 1],
    ]);
    expect(template.sections[0].tasks[0].description).toContain("Cada sección corresponde a una etapa puntual del proceso.");
    expect(template.sections[1].tasks[0].title).toBe("Armado  brief para cliente 🚨");
    expect(template.sections[1].tasks[0].description).toContain("https://docs.google.com/document/d/");
    expect(template.sections[1].tasks[2].description).toContain("https://docs.google.com/spreadsheets/d/");
  });
  it("preserves all 15 one-shot tasks in three ordered sections", () => {
    const template = findProjectTaskTemplate("one_shot")!;
    expect(countTemplateTasks(template)).toBe(15);
    expect(template.sections.map(section => [section.name, section.tasks.length])).toEqual([
      ["Kick off", 5], ["Armado de Proyecto Youscan", 3], ["Informe Digital Intelligence", 7],
    ]);
    expect(template.sections[2].tasks.map(task => task.title)).toEqual(["Análisis", "Diseño ", "Enviar a cliente", "Setear reunión presentación cliente", "Ajustes", "Seguimiento", "Reuniones internas y externas"]);
  });
  it("preserves all three original milestones independently from priority", () => {
    expect(projectTaskTemplates.flatMap(template => template.sections.flatMap(section => section.tasks.filter(task => task.isMilestone).map(task => task.title)))).toEqual([
      "Pedido Autorizaciones (Meta, Linkedin) Cliente", "Envio a cliente Mes XXXX", "Enviar a cliente",
    ]);
  });
  it("supports existing weekly/monthly requests and rejects invented keys", () => {
    expect(findProjectTaskTemplate("weekly")).toBe(findProjectTaskTemplate("monthly"));
    expect(findProjectTaskTemplate("none")).toBeNull();
    expect(projectTemplateKeySchema.safeParse("invented").success).toBe(false);
  });
  it("creates fresh pending tasks and retains a nested parent", () => {
    const source = findProjectTaskTemplate("one_shot")!.sections[2].tasks[2];
    const values = templateTaskValues(source, 12, "Informe Digital Intelligence", 2, 7, 3);
    expect(values).toMatchObject({ title: "Enviar a cliente", isMilestone: true, projectId: 12, parentTaskId: 3, createdBy: 7, status: "todo", priority: "medium", loggedHours: 0, startDate: null, dueDate: null, completedAt: null, assigneeId: null, collaboratorIds: [], recurrenceRule: null });
    expect(insertTaskSchema.parse(values).isMilestone).toBe(true);
    expect(insertTaskSchema.partial().parse({ isMilestone: false }).isMilestone).toBe(false);
  });
  it("preserves notes without carrying over historic hours or recurrence instances", () => {
    for (const template of projectTaskTemplates) for (const section of template.sections) for (const task of section.tasks) {
      const values = templateTaskValues(task, 1, section.name, 0, 1);
      expect(values.description).toBe(task.description);
      expect(values.estimatedHours).toBeNull();
      expect(values.recurrenceSourceTaskId).toBeNull();
    }
  });
  it("applies the milestone migration idempotently and retains the flag in copies", () => {
    expect(taskMilestonesMigrationSql.trim()).toBe(readFileSync("migrations/0073_task_milestones.sql", "utf8").trim());
    expect(readFileSync("server/index.ts", "utf8")).toContain("await run('0073 task milestones', taskMilestonesMigrationSql)");
    expect(readFileSync("server/routes.ts", "utf8")).toContain('isMilestone: task.isMilestone');
  });
});
