export type ProjectTemplateTask = {
  sourceTaskId: string;
  title: string;
  description: string | null;
  isMilestone: boolean;
  subtasks: ProjectTemplateTask[];
};

export type ProjectTaskTemplate = {
  key: string;
  label: string;
  sourceProjectId: string;
  sourceProjectName: string;
  sourceUrl: string;
  capturedOn: string;
  sourceSha256: string;
  sections: Array<{ sourceSectionId: string | null; name: string; tasks: ProjectTemplateTask[] }>;
};

export function countTemplateTasks(template: ProjectTaskTemplate): number {
  const count = (task: ProjectTemplateTask): number => 1 + task.subtasks.reduce((sum, child) => sum + count(child), 0);
  return template.sections.reduce((sum, section) => sum + section.tasks.reduce((total, task) => total + count(task), 0), 0);
}
