import { db, pool } from "../server/db";
import * as schema from "../shared/schema";
import { hashPassword } from "../server/auth";
import { civilDateInBuenosAires } from "../shared/utils/buenos-aires-week";

const url = new URL(process.env.DATABASE_URL!);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !url.pathname.startsWith("/mind_e2e")) throw new Error("Only a dedicated local mind_e2e database may be seeded");
try {
  const password = await hashPassword("mind-local-test-only");
  const people: Array<{ userId: number; personnelId: number }> = [];
  const [role] = await db.insert(schema.roles).values({ name: "E2E role", defaultRate: 10 }).returning();
  for (const [index, firstName] of ["Admin", "Miembro", "Colega", "Gestor"].entries()) {
    const email = `e2e-${index}@example.test`;
    const [user] = await db.insert(schema.users).values({ firstName, lastName: "Auditoría", email, password,
      isAdmin: index === 0, role: index === 0 ? "admin" : "member", permissions: index === 0 ? ["admin", "operations", "finance", "crm", "quotations", "projects", "dashboard", "status"] : index === 3 ? ["task_manager"] : ["projects"] }).returning();
    const [person] = await db.insert(schema.personnel).values({ name: `${firstName} Auditoría`, email, roleId: role.id, hourlyRate: 10 }).returning();
    await db.insert(schema.userNotificationPreferences).values({ userId: user.id, setupCompletedAt: new Date() });
    people.push({ userId: user.id, personnelId: person.id });
  }
  const [client] = await db.insert(schema.clients).values({ name: "Cliente de prueba", contactName: "Contacto de auditoría" }).returning();
  const [project] = await db.insert(schema.activeProjects).values({ clientId: client.id, name: "Proyecto compartido", createdBy: people[0].userId }).returning();
  const [privateProject] = await db.insert(schema.activeProjects).values({ clientId: client.id, name: "Proyecto privado", createdBy: people[0].userId }).returning();
  await db.insert(schema.taskProjectMembers).values([
    { projectId: project.id, personnelId: people[1].personnelId }, { projectId: project.id, personnelId: people[2].personnelId },
    { projectId: privateProject.id, personnelId: people[2].personnelId },
  ]);
  const today = civilDateInBuenosAires(new Date());
  const tasks = await db.insert(schema.tasks).values(Array.from({ length: 140 }, (_, index) => ({
    projectId: project.id, title: index === 0 ? "Tarea pendiente de auditoría" : `Tarea de prueba ${index}`,
    assigneeId: people[1].personnelId, status: "todo", dueDate: new Date(`${today}T12:00:00Z`),
    asanaSource: { raw: "x".repeat(5000), csvRaw: "x".repeat(5000), sourceDuplicates: [], provenance: "fixture" },
  }))).returning();
  await db.insert(schema.tasks).values({ projectId: privateProject.id, title: "Tarea secreta", assigneeId: people[2].personnelId });
  await db.insert(schema.tasks).values([
    { projectId: project.id, title: "Delegada bloqueada", assigneeId: people[2].personnelId, assignedBy: people[1].userId, status: "blocked", dueDate: new Date(`${today}T12:00:00Z`) },
    { projectId: project.id, title: "Delegada finalizada", assigneeId: people[2].personnelId, assignedBy: people[1].userId, status: "done" },
  ]);
  await db.insert(schema.taskTimeEntries).values([
    { taskId: tasks[0].id, personnelId: people[1].personnelId, date: new Date(), hours: 2 },
    { taskId: tasks[0].id, personnelId: people[2].personnelId, date: new Date(), hours: 9 },
  ]);
  // Dedicated section fixtures keep membership regressions independent of task pagination counts.
  for (const memberIndex of [1, 3]) {
    const [sectionProject] = await db.insert(schema.activeProjects).values({ clientId: client.id, name: `Proyecto secciones ${memberIndex}`, createdBy: people[0].userId, taskSectionNames: ["Capacitaciones", "Vacía"] }).returning();
    await db.insert(schema.taskProjectMembers).values([memberIndex, 2].map(index => ({ projectId: sectionProject.id, personnelId: people[index].personnelId, role: "member" })));
    const [sectionTask] = await db.insert(schema.tasks).values({ projectId: sectionProject.id, sectionName: "Capacitaciones", title: "Preparar capacitación", assigneeId: people[2].personnelId, estimatedHours: 5, dueDate: new Date("2026-01-01T12:00:00Z") }).returning();
    await db.insert(schema.tasks).values({ projectId: sectionProject.id, sectionName: "Capacitaciones", title: "Revisar material", parentTaskId: sectionTask.id, assigneeId: people[2].personnelId });
    await db.insert(schema.taskTimeEntries).values({ taskId: sectionTask.id, personnelId: people[memberIndex].personnelId, date: new Date(), hours: 1 });
  }
  const leads = await db.insert(schema.crmLeads).values(Array.from({ length: 120 }, (_, index) => ({ companyName: `Oportunidad ${index}`, createdBy: people[0].userId }))).returning();
  await db.insert(schema.crmActivities).values(leads.flatMap(lead => [
    { leadId: lead.id, type: "note", content: "Anterior", activityDate: new Date("2026-01-01") },
    { leadId: lead.id, type: "note", content: "Última", activityDate: new Date("2026-02-01") },
  ]));
  await db.insert(schema.crmReminders).values(leads.map(lead => ({ leadId: lead.id, description: "Pendiente", dueDate: new Date() })));
  await db.insert(schema.quotations).values(Array.from({ length: 80 }, (_, index) => ({ clientId: client.id, projectName: `Cotización de prueba ${index}`,
    analysisType: "standard", projectType: "executive", mentionsVolume: "small", countriesCovered: "1", clientEngagement: "low",
    baseCost: 100, complexityAdjustment: 0, markupAmount: 50, totalAmount: 150, archivedAt: index === 0 ? new Date() : null,
  })));
  for (const view of ["pnl_mensual", "proyectos_mensual", "costos_mensual", "equipo_mensual", "cashflow", "revenue_por_cliente"]) await pool.query(`CREATE VIEW vw_looker_${view} AS SELECT 1 AS test_value`);
  // Dedicated accounts keep the training journey independent of operational tests.
  for (const profile of ['member', 'admin', 'provider'] as const) {
    const email = `e2e-training-${profile}@example.test`;
    const [user] = await db.insert(schema.users).values({ firstName: 'Capacitación', lastName: profile, email, password,
      role: profile === 'provider' ? 'external_provider' : profile, isAdmin: profile === 'admin',
      permissions: profile === 'member' ? ['task_manager'] : [] }).returning();
    const [person] = await db.insert(schema.personnel).values({ name: `Capacitación ${profile}`, email, roleId: role.id, hourlyRate: 10 }).returning();
    await db.insert(schema.userNotificationPreferences).values({ userId: user.id, setupCompletedAt: new Date() });
    if (profile === 'provider') {
      const [provider] = await db.insert(schema.externalProviders).values({ userId: user.id, companyName: 'Proveedor de capacitación', personnelId: person.id }).returning();
      await db.insert(schema.providerProjectAccess).values({ providerId: provider.id, projectId: project.id, canLogHours: true });
    }
  }
  console.log(JSON.stringify({ people, projectId: project.id, taskId: tasks[0].id, today }));
} finally { await pool.end(); }
