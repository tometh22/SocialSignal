import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SERVICE_BLUEPRINT_SEEDS,
  blueprintDefinitionSchema,
  estimateBlueprintWorkload,
  isDeliverableSold,
  serviceDeliverableSchema,
} from "../shared/quotation-professional";
import {
  describeRoleAffinity,
  inferAreaFromRoleName,
  scoreCandidateForRole,
} from "../shared/utils/personnel-classification";
import { insertTaskTimeEntrySchema } from "../shared/schema";
import { parseHoursInput, roundToMinute } from "../client/src/lib/task-hours";
import { isClosedPeriod } from "../shared/utils/fx-periods";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Feedback Mind V2-13 · ronda 27-8", () => {
  // ── F27-01 · Personal expone una sola taxonomía ──────────────────────────
  it("deriva role_id del nivel canónico y retira el selector legacy del formulario", () => {
    const routes = source("server/routes.ts");
    expect(routes).toContain("async function resolveCanonicalRoleId(");
    // Alta y edición pasan por el resolver.
    expect(routes).toContain("incoming.roleId = await resolveCanonicalRoleId(incoming.currentRole, incoming.roleId);");
    expect(routes).toContain('if (Object.prototype.hasOwnProperty.call(data, "currentRole")) {');

    const admin = source("client/src/pages/admin-fixed.tsx");
    // El form de personal ya no pide el rol legacy; el de plantillas sí lo usa.
    expect(admin).not.toContain('control={personnelForm.control}\n                name="roleId"');
    expect(admin).toContain('control={templateRoleForm.control}');
    const personnelSchemaBlock = admin.slice(
      admin.indexOf("const personnelSchema = z.object({"),
      admin.indexOf("const templateSchema = z.object({"),
    );
    expect(personnelSchemaBlock).toContain("currentRole:");
    expect(personnelSchemaBlock).not.toContain("roleId:");
  });

  // ── F27-02 · El promedio por rol no incluye freelancers ──────────────────
  it("excluye freelancers del promedio de tarifa por rol y subnivel", () => {
    const routes = source("server/routes.ts");
    const rolesQuery = routes.slice(
      routes.indexOf("classification_averages AS"),
      routes.indexOf("ORDER BY average.role_name, average.sublevel"),
    );
    expect(rolesQuery).toContain("COALESCE(p.contract_type, '') <> 'freelance'");
    // Tanto el promedio como el mapeo rol→clasificación aplican el filtro.
    expect(rolesQuery.match(/<> 'freelance'/g)).toHaveLength(2);
  });

  // ── F27-03 · "Proyectado" significa mes sin cerrar ───────────────────────
  it("trata un mes ya terminado como período cerrado", () => {
    const septemberFirst = new Date("2026-09-01T12:00:00Z");
    expect(isClosedPeriod(2026, 8, septemberFirst)).toBe(true);
    expect(isClosedPeriod(2026, 9, septemberFirst)).toBe(false);
    expect(isClosedPeriod(2026, 10, septemberFirst)).toBe(false);
    expect(isClosedPeriod(2025, 12, septemberFirst)).toBe(true);
  });

  it("registra los valores del Máster como observados y retira las proyecciones vencidas", () => {
    const fxSync = source("server/services/fxSync.ts");
    expect(fxSync).toContain("export async function recordObservedRate(");
    expect(fxSync).toContain("export async function demoteStaleProjections(");
    // Un mes cerrado no admite estimaciones nuevas.
    expect(fxSync).toContain("if (isClosedPeriod(est.year, est.month)) continue;");

    const job = source("server/jobs/daily-sot-sync.ts");
    expect(job).toContain("recordObservedRate, demoteStaleProjections");
    expect(job).toContain("source: 'auto_sync_maestro'");
    // El job ya no escribe la tabla salteando la degradación de la estimación.
    expect(job).not.toContain("await db.update(exchangeRates)");
  });

  // ── F27-04 · Alcance acepta coma, espacio y Enter ────────────────────────
  it("parsea los campos de lista al salir del campo y no en cada tecla", () => {
    const builder = source("client/src/components/quotation/professional-scope-builder.tsx");
    expect(builder).toContain("function useDeferredText(");
    expect(builder).toContain("function DeferredTextarea(");
    // ListField y Objetivos usan el editor diferido.
    expect(builder).toContain("const field = useDeferredText(value, onChange);");
    expect(builder).toContain("<DeferredTextarea rows={3}");
    // El commit ocurre en onBlur, nunca en onChange.
    expect(builder).toContain("onBlur: () => {");
    expect(builder).not.toContain('onChange={(event) => onChange(event.target.value)} placeholder="Separá valores con comas"');
  });

  // ── F27-05 · Entregables en cero y cadencia editable ─────────────────────
  it("acepta cantidad cero en un entregable y deja de imputar sus horas", () => {
    const base = {
      id: "a0000000-0000-4000-8000-000000000001",
      name: "Instancia ejecutiva",
      type: "executive_report",
      format: "pptx",
      cadence: "once",
      description: "Sesión de cierre con el comité.",
      roleHours: { director: 4, analyst: 10 },
    };
    expect(serviceDeliverableSchema.parse({ ...base, quantity: 0 }).quantity).toBe(0);
    expect(() => serviceDeliverableSchema.parse({ ...base, quantity: -1 })).toThrow();

    // Una receta real del catálogo, con su único entregable puesto en cero.
    const seed = blueprintDefinitionSchema.parse(SERVICE_BLUEPRINT_SEEDS[0].definition);
    const withDeliverable = estimateBlueprintWorkload(seed).totalHours;
    const zeroed = blueprintDefinitionSchema.parse({
      ...seed,
      setupRoleHours: {},
      deliverables: seed.deliverables.map((deliverable) => ({ ...deliverable, quantity: 0 })),
    });
    expect(withDeliverable).toBeGreaterThan(0);
    expect(estimateBlueprintWorkload(zeroed).totalHours).toBe(0);
  });

  it("saca del alcance vendido un entregable cotizado en cero", () => {
    // Cero unidades no es "incluido con cantidad cero": es no vendido. Si no,
    // el entregable seguía apareciendo en la propuesta que ve el cliente.
    expect(isDeliverableSold({ included: true, quantity: 0 })).toBe(false);
    expect(isDeliverableSold({ included: true, quantity: 1 })).toBe(true);
    expect(isDeliverableSold({ included: false, quantity: 3 })).toBe(false);
    // Sin cantidad explícita se asume una unidad (recetas y datos legacy).
    expect(isDeliverableSold({ included: true })).toBe(true);
    expect(isDeliverableSold({})).toBe(true);
  });

  it("aplica ese predicado en todo consumidor, no sólo en el cálculo de horas", () => {
    // La propuesta al cliente, los conteos de entregables y la generación de
    // tareas tienen que coincidir con las horas cotizadas.
    expect(source("server/services/proposal-studio.ts")).toContain("deliverables.filter(isDeliverableSold)");
    expect(source("server/routes.ts")).toContain("definition.deliverables.filter(isDeliverableSold)");
    const variants = source("client/src/components/optimized/QuotationVariants.tsx");
    expect(variants.match(/filter\(isDeliverableSold\)/g)?.length).toBe(3);
    expect(variants).not.toContain("filter((item) => item.included)");
  });

  it("permite editar la cadencia del entregable", () => {
    const builder = source("client/src/components/quotation/professional-scope-builder.tsx");
    expect(builder).toContain("const CADENCES = [");
    expect(builder).toContain("onValueChange={(cadence: any) => updateScope(");
    // La cadencia dejó de ser un badge de sólo lectura.
    expect(builder).not.toContain('<Badge variant="outline" className="mt-1 block w-fit">{deliverable.cadence}</Badge>');
    expect(builder).toContain('min={0}');
  });

  // ── F27-06 · Candidatos cruzados con el rol ──────────────────────────────
  it("infiere el área de los roles que nombran una función, no un nivel", () => {
    // Estos son los nombres reales del catálogo. Cruzar sólo por seniority
    // dejaba a la mitad sin ordenar, que era el agujero de la primera pasada.
    expect(inferAreaFromRoleName("Data Scientist")).toBe("DataTech");
    expect(inferAreaFromRoleName("Project Manager")).toBe("Operaciones");
    expect(inferAreaFromRoleName("Content Specialist")).toBe("Marketing");
    expect(inferAreaFromRoleName("Account Director")).toBe("Cuenta");
    // "Analista" es ambiguo entre áreas: no se adivina.
    expect(inferAreaFromRoleName("Analista Senior")).toBeNull();
    expect(inferAreaFromRoleName("")).toBeNull();
  });

  it("puntúa candidatos por nivel y por área, con el nivel pesando más", () => {
    const leadOps = { currentRole: "4 Lead", area: "Operaciones" };
    const juniorOps = { currentRole: "1 Junior", area: "Operaciones" };
    const leadData = { currentRole: "4 Lead", area: "DataTech" };

    // "Lead PM" codifica ambas dimensiones: nivel 4 Lead + área Operaciones.
    expect(scoreCandidateForRole("Lead PM", leadOps)).toBe(3);
    expect(scoreCandidateForRole("Lead PM", leadData)).toBe(2);
    expect(scoreCandidateForRole("Lead PM", juniorOps)).toBe(1);
    expect(scoreCandidateForRole("Lead PM", { currentRole: "1 Junior", area: "Marketing" })).toBe(0);

    // El nivel pesa más que el área.
    expect(scoreCandidateForRole("Lead PM", leadData))
      .toBeGreaterThan(scoreCandidateForRole("Lead PM", juniorOps));

    // Un rol que sólo nombra función ordena igual, que era lo que no pasaba.
    expect(scoreCandidateForRole("Data Scientist", leadData)).toBe(1);
    expect(scoreCandidateForRole("Data Scientist", leadOps)).toBe(0);

    // Un rol del que no se infiere nada no ordena a nadie.
    expect(describeRoleAffinity("Colaborador")).toBeNull();
    expect(scoreCandidateForRole("Colaborador", leadOps)).toBe(0);
  });

  it("no filtra en duro: un puesto sin perfiles afines conserva candidatos", () => {
    const team = source("client/src/components/optimized/EnhancedTeamConfig.tsx");
    expect(team).toContain("if (!affinity) return { matching: [], others: available, affinity: null };");
    expect(team).toContain("others: scored.filter((item) => item.score === 0)");
  });

  // ── F27-08 · La tarea de la Home abre su proyecto ────────────────────────
  it("enlaza cada fila de la home al proyecto asociado", () => {
    const home = source("client/src/pages/tasks/tasks-home.tsx");
    expect(home).toContain("function TaskRowTarget(");
    expect(home).toContain("href={`/tasks/projects/${projectId}`}");
    // Sin proyecto no se emite un enlace muerto.
    expect(home).toContain("if (!projectId) return <div className={className}>{children}</div>;");
    expect(home).toContain("<TaskRowTarget projectId={task.projectId}");
  });

  // ── F27-09 a F27-13 · Reloj rápido ──────────────────────────────────────
  it("permite corregir y eliminar cargas desde el reloj de la fila", () => {
    const quick = source("client/src/components/tasks/QuickTaskHours.tsx");
    expect(quick).toContain('apiRequest(`/api/tasks/${taskId}/time/${entryId}`, "PATCH"');
    expect(quick).toContain('apiRequest(`/api/tasks/${taskId}/time/${entryId}`, "DELETE")');
    expect(quick).toContain("Corregir la carga de");
    expect(quick).toContain("Eliminar la carga de");
  });

  it("invalida la lista del proyecto, que es la fuente de las horas de la fila", () => {
    const quick = source("client/src/components/tasks/QuickTaskHours.tsx");
    expect(quick).toContain('queryKey: ["/api/tasks/project", projectId]');
    const list = source("client/src/components/tasks/ProjectTaskList.tsx");
    expect(list).toContain('queryKey: ["/api/tasks/project", projectId]');
  });

  it("propaga la prioridad editada en la fila al detalle de la tarea", () => {
    const list = source("client/src/components/tasks/ProjectTaskList.tsx");
    const priorityBlock = list.slice(list.indexOf("const priorityMutation"), list.indexOf("const assignee ="));
    expect(priorityBlock).toContain('queryKey: ["/api/tasks", task.id]');
  });

  it("atribuye la carga rápida al responsable de la tarea por defecto", () => {
    const quick = source("client/src/components/tasks/QuickTaskHours.tsx");
    expect(quick).toContain("if (taskSummary?.assigneeId) setPersonnelId(String(taskSummary.assigneeId));");
    expect(quick).toContain("· responsable");
  });

  it("acepta minutos reales y redondea al minuto, no al cuarto de hora", () => {
    expect(parseHoursInput("45m")).toBeCloseTo(0.75, 6);
    expect(parseHoursInput("45min")).toBeCloseTo(0.75, 6);
    expect(parseHoursInput("1h30")).toBeCloseTo(1.5, 6);
    expect(parseHoursInput("1h30m")).toBeCloseTo(1.5, 6);
    expect(parseHoursInput("2:15")).toBeCloseTo(2.25, 6);
    expect(parseHoursInput("2,5")).toBeCloseTo(2.5, 6);
    expect(parseHoursInput("2.5")).toBeCloseTo(2.5, 6);
    expect(parseHoursInput("10m")).toBeCloseTo(1 / 6, 6);
    expect(parseHoursInput("")).toBeNull();
    expect(parseHoursInput("qué")).toBeNull();

    // 10 minutos sobrevive: antes se redondeaba a 15.
    expect(roundToMinute(10 / 60)).toBeCloseTo(10 / 60, 6);
    expect(insertTaskTimeEntrySchema.shape.hours.safeParse(10 / 60).success).toBe(true);
    expect(insertTaskTimeEntrySchema.shape.hours.safeParse(0).success).toBe(false);

    const routes = source("server/routes.ts");
    expect(routes).not.toContain("Las horas deben ser al menos 0.25");
  });

  it("permite crear la razón social sin salir del cotizador", () => {
    const basicInfo = source("client/src/components/optimized/basic-info.tsx");
    expect(basicInfo).toContain("function InlineBillingEntity(");
    expect(basicInfo).toContain("`/api/clients/${clientId}/billing-entities`, 'POST'");
    // La entidad creada queda seleccionada en el acto.
    expect(basicInfo).toContain("updateQuotationData({ billingEntityId: entity.id })");
  });
  // ── GEN-01 · Limpieza de datos de prueba (pedida el 18-8, 20-8 y 27-8) ───
  it("ofrece una limpieza reversible que sí puede correr en producción", () => {
    const routes = source("server/routes.ts");
    expect(routes).toContain('app.get("/api/admin/cleanup/candidates"');
    expect(routes).toContain('app.post("/api/admin/cleanup/archive"');

    const cleanup = routes.slice(
      routes.indexOf("// =========== LIMPIEZA DE DATOS DE PRUEBA ==========="),
      routes.indexOf("// =========== FACTURA MENSUAL PERSONAL ==========="),
    );
    // Nada se borra: cotizaciones se archivan y proyectos pasan a voided.
    expect(cleanup).toContain("archivedAt: now");
    expect(cleanup).toContain('status: "voided"');
    expect(cleanup).not.toContain("db.delete(");
    // A diferencia del reset viejo, no se bloquea en producción.
    expect(cleanup).not.toContain('NODE_ENV === "production"');
    // Sólo Admin.
    expect(cleanup.match(/req\.user\?\.isAdmin/g)?.length).toBe(2);
  });

  it("nunca archiva por coincidencia de nombre: exige ids elegidos por una persona", () => {
    const routes = source("server/routes.ts");
    const archive = routes.slice(
      routes.indexOf('app.post("/api/admin/cleanup/archive"'),
      routes.indexOf("// =========== FACTURA MENSUAL PERSONAL ==========="),
    );
    // El endpoint que actúa no conoce el patrón de nombres; sólo ids explícitos.
    expect(archive).not.toContain("CLEANUP_NAME_PATTERN");
    expect(archive).toContain("inArray(quotations.id, quotationIds)");
    expect(archive).toContain("inArray(activeProjects.id, projectIds)");
    // Sin selección no hace nada.
    expect(archive).toContain("Elegí al menos una cotización o proyecto para archivar");
  });

  it("no propone archivar una cotización aprobada y vigente", () => {
    const routes = source("server/routes.ts");
    const candidates = routes.slice(
      routes.indexOf('app.get("/api/admin/cleanup/candidates"'),
      routes.indexOf('app.post("/api/admin/cleanup/archive"'),
    );
    // Sólo entra lo que no originó proyecto y además es prueba, borrador o vencida.
    expect(candidates).toContain("ap.id IS NULL");
    expect(candidates).toContain("q.archived_at IS NULL");
    expect(candidates).toContain("'draft', 'rejected', 'in-negotiation'");
    // Un proyecto ya cerrado tampoco se vuelve a proponer.
    expect(candidates).toContain("ap.status NOT IN ('voided', 'cancelled', 'completed')");
  });
});
