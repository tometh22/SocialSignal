import { expect, test } from "@playwright/test";

for (const index of [1, 3]) test(`a project member with ${index === 3 ? "task_manager" : "projects"} permission can move, fold and delete sections without losing logged hours`, async ({ page }) => {
  const request = page.request;
  expect((await request.post("/api/login", { data: { email: `e2e-${index}@example.test`, password: "mind-local-test-only" } })).ok()).toBeTruthy();
  const projects = await (await request.get("/api/tasks/projects")).json();
  const project = projects.find((item: any) => item.name === `Proyecto secciones ${index}`);
  expect(project).toBeTruthy();
  const path = `/api/tasks/project/${project.id}`;
  const original = await (await request.get(path)).json();
  expect(original).toMatchObject({ canManageSections: true, canEditSections: true });

  // Section permissions stay scoped to the member’s project.
  expect((await request.put("/api/tasks/section/rename", { data: { projectId: 2, oldName: "General", newName: "Ajena" } })).status()).toBe(403);
  expect((await request.post("/api/tasks/section/duplicate", { data: { projectId: 2, sectionName: "General", newName: "Ajena" } })).status()).toBe(403);
  expect((await request.delete("/api/tasks/section", { data: { projectId: project.id, sectionName: "Capacitaciones" } })).status()).toBe(409);
  expect((await request.delete("/api/tasks/section", { data: { projectId: 2, sectionName: "General" } })).status()).toBe(403);

  await page.goto(`/tasks/projects/${project.id}`);
  await page.getByRole("button", { name: "Opciones de sección Capacitaciones", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Renombrar sección" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Duplicar sección" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Eliminar sección" })).toBeVisible();
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

  await page.reload();
  await expect(page.getByRole("button", { name: "Renombrar sección Vacía copia", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Contraer todas", exact: true }).click();
  await expect(page.getByRole("button", { name: "Desplegar sección Capacitaciones copia", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Desplegar todas", exact: true }).click();

  const handle = page.locator(`[data-task-row="${root.id}"] [aria-roledescription="sortable"]`);
  await handle.hover();
  await handle.dragTo(page.getByRole("button", { name: "Renombrar sección Vacía copia", exact: true }));
  await expect.poll(async () => {
    const moved = await (await request.get(path)).json();
    return moved.tasks.filter((task: any) => [root.id, child.id].includes(task.id)).map((task: any) => task.sectionName);
  }).toEqual(["Vacía copia", "Vacía copia"]);
  await page.getByRole("button", { name: "Opciones de sección Vacía copia", exact: true }).click();
  await page.getByRole("menuitem", { name: "Eliminar sección" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Renombrar sección Vacía copia", exact: true })).toHaveCount(0);
  await expect.poll(async () => {
    const afterDelete = await (await request.get(path)).json();
    return afterDelete.tasks.some((task: any) => [root.id, child.id].includes(task.id));
  }).toBe(false);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("button", { name: "Opciones de sección Capacitaciones del equipo", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Renombrar sección" })).toBeVisible();
  await page.screenshot({ path: `.context/sections-member-${index}-mobile.png`, fullPage: true, animations: "disabled" });
  await page.keyboard.press("Escape");

  // A section with logged hours is deleted too: tasks without hours go away and
  // only the tasks with history move to the section the member picks, never to General.
  const unlogged = await (await request.post("/api/tasks", { data: { projectId: project.id, sectionName: "Capacitaciones del equipo", title: "Sin horas" } })).json();
  const logged = state.tasks.filter((task: any) => task.sectionName === "Capacitaciones del equipo").map((task: any) => task.id);
  expect((await request.delete("/api/tasks/section", { data: { projectId: project.id, sectionName: "Capacitaciones del equipo", moveLoggedTo: "General" } })).status()).toBe(409);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await page.getByRole("button", { name: "Opciones de sección Capacitaciones del equipo", exact: true }).click();
  await page.getByRole("menuitem", { name: "Eliminar sección" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("1 tarea tiene horas registradas");
  await expect(dialog).toContainText("1 tarea sin horas");
  await dialog.getByRole("combobox", { name: "Sección para las tareas con horas" }).click();
  await page.getByRole("option", { name: "Vacía renombrada", exact: true }).click();
  await page.screenshot({ path: `.context/sections-delete-logged-${index}.png`, animations: "disabled" });
  await dialog.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Renombrar sección Capacitaciones del equipo", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Renombrar sección Vacía renombrada", exact: true })).toBeVisible();
  const afterLoggedDelete = await (await request.get(path)).json();
  expect(afterLoggedDelete.tasks.some((task: any) => task.id === unlogged.id)).toBe(false);
  expect(afterLoggedDelete.tasks.filter((task: any) => logged.includes(task.id)).map((task: any) => task.sectionName)).toEqual(["Vacía renombrada", "Vacía renombrada"]);
  expect(afterLoggedDelete.sections["Capacitaciones del equipo"]).toBeUndefined();
});
