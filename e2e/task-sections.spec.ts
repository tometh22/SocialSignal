import { expect, test } from "@playwright/test";

for (const index of [1, 3]) test(`a project member with ${index === 3 ? "task_manager" : "projects"} permission can rename and duplicate collapsed and empty sections`, async ({ page }) => {
  const request = page.request;
  expect((await request.post("/api/login", { data: { email: `e2e-${index}@example.test`, password: "mind-local-test-only" } })).ok()).toBeTruthy();
  const projects = await (await request.get("/api/tasks/projects")).json();
  const project = projects.find((item: any) => item.name === `Proyecto secciones ${index}`);
  expect(project).toBeTruthy();
  const path = `/api/tasks/project/${project.id}`;
  const original = await (await request.get(path)).json();
  expect(original).toMatchObject({ canManageSections: false, canEditSections: true });

  // Membership permits section edits, but neither edits in another project nor section deletion.
  expect((await request.put("/api/tasks/section/rename", { data: { projectId: 2, oldName: "General", newName: "Ajena" } })).status()).toBe(403);
  expect((await request.post("/api/tasks/section/duplicate", { data: { projectId: 2, sectionName: "General", newName: "Ajena" } })).status()).toBe(403);
  expect((await request.delete("/api/tasks/section", { data: { projectId: project.id, sectionName: "Capacitaciones" } })).status()).toBe(403);

  await page.goto(`/tasks/projects/${project.id}`);
  await page.getByRole("button", { name: "Opciones de sección Capacitaciones", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Renombrar sección" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Duplicar sección" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Eliminar sección" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Renombrar sección" }).click();
  await page.getByRole("textbox", { name: "Nombre de sección Capacitaciones", exact: true }).fill("Capacitaciones del equipo");
  await page.getByRole("textbox", { name: "Nombre de sección Capacitaciones", exact: true }).press("Enter");
  await expect(page.getByRole("button", { name: "Renombrar sección Capacitaciones del equipo", exact: true })).toBeVisible();

  // The inline name remains editable without having to find the menu.
  await page.getByRole("button", { name: "Renombrar sección Vacía", exact: true }).click();
  await page.getByRole("textbox", { name: "Nombre de sección Vacía", exact: true }).fill("Vacía renombrada");
  await page.getByRole("textbox", { name: "Nombre de sección Vacía", exact: true }).press("Enter");
  await expect(page.getByRole("button", { name: "Renombrar sección Vacía renombrada", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Plegar sección Capacitaciones del equipo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Desplegar sección Capacitaciones del equipo", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Opciones de sección Capacitaciones del equipo", exact: true }).click();
  page.once("dialog", dialog => dialog.accept("Capacitaciones copia"));
  await page.getByRole("menuitem", { name: "Duplicar sección" }).click();
  await expect(page.getByRole("button", { name: "Renombrar sección Capacitaciones copia", exact: true })).toBeVisible();

  const state = await (await request.get(path)).json();
  const copied = state.tasks.filter((task: any) => task.sectionName === "Capacitaciones copia");
  const root = copied.find((task: any) => task.title === "Preparar capacitación");
  const child = copied.find((task: any) => task.title === "Revisar material");
  expect(copied).toHaveLength(2);
  expect(child.parentTaskId).toBe(root.id);
  expect(root).toMatchObject({ status: "todo", dueDate: null, estimatedHours: 0, loggedHours: 0, assigneeId: original.tasks[0].assigneeId });
  expect(state.tasks.filter((task: any) => task.sectionName === "Capacitaciones del equipo")).toHaveLength(2);
  expect(state.sections["Vacía renombrada"]).toEqual([]);
  expect((await request.post("/api/tasks/section/duplicate", { data: { projectId: project.id, sectionName: "Vacía renombrada", newName: "Capacitaciones copia" } })).status()).toBe(409);
  expect((await request.post("/api/tasks/section/duplicate", { data: { projectId: project.id, sectionName: "Vacía renombrada", newName: "Vacía copia" } })).status()).toBe(201);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("button", { name: "Opciones de sección Capacitaciones del equipo", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Renombrar sección" })).toBeVisible();
  await page.screenshot({ path: `.context/sections-member-${index}-mobile.png`, fullPage: true, animations: "disabled" });
});
