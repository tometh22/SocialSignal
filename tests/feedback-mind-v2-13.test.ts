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
  formatCanonicalRoleName,
  personMatchesRole,
  resolveCanonicalRoleForBlueprintKey,
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
    expect(routes).toContain("incoming.roleId = await resolveCanonicalRoleId(incoming.currentRole, incoming.sublevel, incoming.area, incoming.roleId);");
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
  it("nombra los roles con la numeración de la escala y el área", () => {
    expect(formatCanonicalRoleName("4 Lead", "A", "Operaciones")).toBe("04 Lead A · Operaciones");
    expect(formatCanonicalRoleName("3 Senior", "B", "DataTech")).toBe("03 Senior B · DataTech");
    expect(formatCanonicalRoleName("5 Lead de Leads", "A", "Cuenta")).toBe("05 Lead de Leads A · Cuenta");
    // Sin nivel no hay rol canónico posible.
    expect(formatCanonicalRoleName("Account Director", "A", "Cuenta")).toBe("05 Lead de Leads A · Cuenta");
    expect(formatCanonicalRoleName("", "A", "Cuenta")).toBeNull();
  });

  it("ofrece un puesto sólo a quien coincide en nivel, subnivel y área", () => {
    const role = { roleLevel: "4 Lead", sublevel: "A", area: "Operaciones" };
    expect(personMatchesRole(role, { currentRole: "4 Lead", sublevel: "A", area: "Operaciones" })).toBe(true);
    // Cada dimensión restringe por separado.
    expect(personMatchesRole(role, { currentRole: "3 Senior", sublevel: "A", area: "Operaciones" })).toBe(false);
    expect(personMatchesRole(role, { currentRole: "4 Lead", sublevel: "B", area: "Operaciones" })).toBe(false);
    expect(personMatchesRole(role, { currentRole: "4 Lead", sublevel: "A", area: "DataTech" })).toBe(false);

    // Un rol que no fija subnivel ni área no restringe por esas dimensiones.
    const anyLead = { roleLevel: "4 Lead", sublevel: null, area: null };
    expect(personMatchesRole(anyLead, { currentRole: "4 Lead", sublevel: "C", area: "Marketing" })).toBe(true);
    // Un rol del catálogo viejo no ofrece a nadie.
    expect(personMatchesRole({ roleLevel: null }, { currentRole: "4 Lead" })).toBe(false);
  });

  it("traduce cada función de receta al rol canónico de su área", () => {
    const catalogue = [
      { id: 1, roleLevel: "4 Lead", area: "Operaciones", isActive: true },
      { id: 2, roleLevel: "3 Senior", area: "Operaciones", isActive: true },
      { id: 3, roleLevel: "3 Senior", area: "DataTech", isActive: true },
      { id: 4, roleLevel: "2 Semi Senior", area: "Marketing", isActive: true },
      { id: 5, roleLevel: "5 Lead de Leads", area: "Cuenta", isActive: true },
      { id: 6, roleLevel: null, area: null, isActive: false },
    ];
    // Área y nivel exactos cuando existen.
    expect(resolveCanonicalRoleForBlueprintKey("pm", catalogue)?.id).toBe(1);
    expect(resolveCanonicalRoleForBlueprintKey("analyst", catalogue)?.id).toBe(2);
    expect(resolveCanonicalRoleForBlueprintKey("data", catalogue)?.id).toBe(3);
    expect(resolveCanonicalRoleForBlueprintKey("design", catalogue)?.id).toBe(4);
    expect(resolveCanonicalRoleForBlueprintKey("director", catalogue)?.id).toBe(5);

    // Sin el nivel típico se cae a cualquiera del área, no a otra área.
    const sinLead = catalogue.filter((role) => role.id !== 1);
    expect(resolveCanonicalRoleForBlueprintKey("pm", sinLead)?.id).toBe(2);
    // Sin nadie del área no inventa un rol de otra.
    expect(resolveCanonicalRoleForBlueprintKey("design", [catalogue[0]])).toBeUndefined();
    // Los roles retirados nunca se proponen.
    expect(resolveCanonicalRoleForBlueprintKey("pm", [catalogue[5]])).toBeUndefined();
  });

  it("filtra en duro por clasificación y deja una salida para no bloquear", () => {
    const team = source("client/src/components/optimized/EnhancedTeamConfig.tsx");
    expect(team).toContain("personMatchesRole(role, person as any)");
    // Un puesto sin perfiles lo dice, en vez de mostrar un selector vacío.
    expect(team).toContain("Nadie con la clasificación");
    expect(team).toContain("perfiles de otra clasificación");
  });

  it("una cotización nueva no ofrece roles del catálogo viejo", () => {
    const context = source("client/src/context/optimized-quote-context.tsx");
    expect(context).toContain('(role as any).isActive !== false && (role as any).roleLevel');
    // Nunca deja el selector vacío si la base todavía no migró.
    expect(context).toContain("canonical.length > 0 ? canonical : allRoles");
  });

  // ── GEN-14 · No duplicar un rol cuando dos funciones de receta colisionan ──
  it("agrupa por rol canónico en vez de crear una fila por función de receta", () => {
    // Reporte real de Victoria Puricelli: "repite lead de leads más de una
    // vez, y es la misma persona... es normal?" — no lo era. Cuando dos
    // funciones de la receta (p. ej. "pm" y "analyst") caían por fallback en
    // el mismo rol canónico porque esa área no tiene el nivel exacto, cada
    // una generaba su propia fila con Object.entries(...).flatMap(...),
    // duplicando literalmente el rol y la persona ya asignada.
    const builder = source("client/src/components/quotation/professional-scope-builder.tsx");
    expect(builder).toContain("const hoursByRoleId = new Map<number,");
    expect(builder).toContain("const accumulated = hoursByRoleId.get(role.id);");
    expect(builder).toContain("if (accumulated) accumulated.hours += hours;");
    // Una sola fila por rol.id: el flatMap de 1 fila por función de receta
    // quedó atrás.
    expect(builder).not.toContain("Object.entries(workload.byRole).flatMap(([roleKey, hours]) => {");
    expect(builder).toContain("[...hoursByRoleId.values()].map(({ role, hours }) => {");
  });

  // ── GEN-15 · $0/hora silencioso cuando falta el tipo de cambio ──────────
  it("avisa en Equipo cuando el tipo de cambio de la cotización no está confirmado", () => {
    // Reporte real: "todos los valores hora están en cero, puse a Acha
    // arriba de todo y no me lo toma". Los datos en Personal estaban
    // correctos. La causa real: resolveQuotationPersonnelRate corta en 0
    // para cualquier persona si el tipo de cambio de ESA cotización no es
    // positivo — y el paso Equipo (4) se puede alcanzar sin haber pasado por
    // Inversión (5), el único paso que lo exige. No había ninguna señal
    // visible de por qué el valor daba $0.
    const teamConfig = source("client/src/components/optimized/EnhancedTeamConfig.tsx");
    expect(teamConfig).toContain("const missingExchangeRateSnapshot = !(Number(quotationData.exchangeRateSnapshot) > 0);");
    expect(teamConfig).toContain("Falta confirmar el tipo de cambio de esta cotización.");
    expect(teamConfig).toContain("onClick={() => goToStep(5)}");
  });

  it("resuelve el tipo de cambio sin salir de Equipo: sugiere el registrado o acepta uno manual", () => {
    // Pedido explícito de negocio: "para evitar fricción en el uso, el
    // cotizador debería poder sugerir ahí el tipo de cambio registrado o
    // permitirle al usuario usar otro". Ir a Inversión queda como salida,
    // no como único camino.
    const teamConfig = source("client/src/components/optimized/EnhancedTeamConfig.tsx");
    // Sugiere el vigente con un click.
    expect(teamConfig).toContain("onClick={() => updateQuotationCurrency(currency, exchangeRate)}");
    expect(teamConfig).toContain("Usar el registrado");
    // Acepta uno manual, con la misma tolerancia a coma decimal que el resto
    // de los inputs numéricos de la app.
    expect(teamConfig).toContain("value={customExchangeRateInput}");
    expect(teamConfig).toContain("const parsed = parseDecimalInput(customExchangeRateInput, 0);");
    expect(teamConfig).toContain("if (parsed > 0) { updateQuotationCurrency(currency, parsed); setCustomExchangeRateInput(\'\'); }");
    // updateQuotationCurrency ya recalcula las tarifas del equipo con el
    // nuevo snapshot: confirmar acá no deja al usuario con $0 residuales
    // hasta volver a tocar algo.
    const contextFn = source("client/src/context/optimized-quote-context.tsx");
    const updateFn = contextFn.slice(
      contextFn.indexOf("const updateQuotationCurrency = useCallback("),
      contextFn.indexOf("const updateSalaryMonth = useCallback("),
    );
    expect(updateFn).toContain("const updatedMembers = prev.teamMembers.map(member =>");
    expect(updateFn).toContain("requiresExchangeRateConfirmation: exchangeRateOverride && exchangeRateOverride > 0\n          ? false");
  });

  it("confirma que la fórmula de tarifa corta en 0 antes de leer ningún dato de Personal", () => {
    const rateFormula = source("shared/utils/quotation-personnel-rate.ts");
    const start = rateFormula.indexOf("export function resolveQuotationPersonnelRate");
    const gate = rateFormula.slice(start, start + 300);
    expect(gate).toContain("const quotationExchangeRate = positiveNumber(input.quotationExchangeRate);");
    expect(gate).toContain("if (!quotationExchangeRate) return 0;");
  });

  it("el paso Equipo se puede alcanzar sin haber confirmado el tipo de cambio en Inversión", () => {
    const ux = source("client/src/utils/quotation-ux.ts");
    const step1 = ux.slice(ux.indexOf("if (step === 1) {"), ux.indexOf("if (step === 2 || step === 3)"));
    const step4Line = ux.slice(ux.indexOf("if (step === 4)"), ux.indexOf("if (step === 5)"));
    // El tipo de cambio sólo se exige en el paso 5, nunca antes.
    expect(step1).not.toContain("hasPositiveExchangeRate");
    expect(step4Line).not.toContain("hasPositiveExchangeRate");
    expect(ux).toContain("if (!hasPositiveExchangeRate(quotation)) {");
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
    // El proyecto queda igual de bloqueado que con el botón oficial de
    // "Anular": si no, dejaba de listarse pero seguía aceptando cargas.
    expect(cleanup).toContain("isFinished: true");
    expect(cleanup).toContain("closedAt: now");
    // Sólo Admin: candidates, archive y restore-project.
    expect(cleanup.match(/req\.user\?\.isAdmin/g)?.length).toBe(3);
  });

  it("archivar un proyecto no cambia ningún número financiero histórico", () => {
    // Las tablas de hechos se calculan por fecha desde las horas cargadas, no
    // desde el estado del proyecto: archivar no puede alterar un período ya
    // reportado. Se verifica la ausencia del acoplamiento, no su presencia.
    const financialAggregator = source("server/domain/financial-aggregator.ts");
    const viewAggregator = source("server/domain/view-aggregator.ts");
    expect(financialAggregator).not.toContain("activeProjects.status");
    expect(viewAggregator).not.toContain("activeProjects.status");
  });

  it("restaura un proyecto anulado a su estado activo, simétrico al restore de cotizaciones", () => {
    const routes = source("server/routes.ts");
    expect(routes).toContain('app.post("/api/admin/cleanup/restore-project"');
    const restore = routes.slice(
      routes.indexOf('app.post("/api/admin/cleanup/restore-project"'),
      routes.indexOf("// =========== FACTURA MENSUAL PERSONAL ==========="),
    );
    expect(restore).toContain('status: "active"');
    expect(restore).toContain("isFinished: false");
    expect(restore).toContain("closedAt: null");
    // Sólo restaura lo que la propia limpieza (o el botón oficial) anuló.
    expect(restore).toContain('eq(activeProjects.status, "voided")');
  });

  it("no filtra proyectos sólo por nombre: pedía sacar el histórico, no sólo las pruebas", () => {
    const routes = source("server/routes.ts");
    const candidates = routes.slice(
      routes.indexOf('app.get("/api/admin/cleanup/candidates"'),
      routes.indexOf('app.post("/api/admin/cleanup/archive"'),
    );
    const projectsQuery = candidates.slice(0, candidates.indexOf("Una cotización se sugiere"));
    // El filtro de nombre pasó a ser un criterio de orden/etiqueta, no un WHERE:
    // ya no hay un segundo AND que descarte todo lo que no matchea el patrón.
    expect(projectsQuery).not.toContain("AND LOWER(COALESCE(NULLIF(TRIM(ap.name)");
    expect(projectsQuery).toContain("last_activity_at");
    expect(projectsQuery).toContain("180 days");
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
  // ── GEN-12 · Recuperar cotizaciones archivadas sin saber el id ──────────
  it("expone un listado de cotizaciones archivadas, accesible sin ser Admin", () => {
    const routes = source("server/routes.ts");
    const archivedIndex = routes.indexOf('app.get("/api/quotations/archived"');
    const byIdIndex = routes.indexOf('app.get("/api/quotations/:id"');
    expect(archivedIndex).toBeGreaterThan(-1);
    // Express matchea rutas en orden de registro: ":id" habría interceptado
    // "archived" como si fuera un id si se registraba después. La red de
    // seguridad de tests/express-route-order.test.ts detectó exactamente esto.
    expect(archivedIndex).toBeLessThan(byIdIndex);
    const listRoute = routes.slice(archivedIndex, byIdIndex);
    // El mismo permiso que ya usan las demás rutas de Gestión de Cotizaciones,
    // no el de Admin: la limpieza de datos ya existía por dos caminos
    // (el tacho preexistente de Gestión y la Limpieza de Admin) y las dos
    // debían quedar visibles desde donde se archivó.
    expect(listRoute).toContain('requirePermission("quotations")');
    expect(listRoute).toContain("isNotNull(quotations.archivedAt)");
  });

  it("ofrece ver y restaurar archivadas tanto en Gestión de Cotizaciones como en Limpieza", () => {
    const dialog = source("client/src/components/quotation/archived-quotations-dialog.tsx");
    expect(dialog).toContain("export function ArchivedQuotationsList()");
    expect(dialog).toContain("export function ArchivedQuotationsDialog()");
    expect(dialog).toContain('apiRequest(`/api/quotations/${id}/restore`, "POST")');

    const manageQuotes = source("client/src/pages/manage-quotes.tsx");
    expect(manageQuotes).toContain("<ArchivedQuotationsDialog />");

    const cleanup = source("client/src/components/admin/TestDataCleanup.tsx");
    expect(cleanup).toContain("<ArchivedQuotationsList />");
  });
  // ── GEN-17 · "Valor total" señala su mayor contribuyente ────────────────
  it("identifica la cotización que más pesa en el Valor total de la cartera", () => {
    // Reporte real: un "Valor total" de ARS 13.700 millones para 28
    // cotizaciones (19 aprobadas) llamó la atención por lo desproporcionado.
    // La suma ya incluía borradores, rechazadas y vencidas -- no sólo
    // vigentes -- así que un total así casi siempre es UNA cotización con un
    // monto mal cargado (frecuente en el histórico de pruebas de esta
    // cuenta), no un error de cálculo. Sin esto, encontrarla exigía revisar
    // las 28 una por una.
    const manageQuotes = source("client/src/pages/manage-quotes.tsx");
    expect(manageQuotes).toContain("topValueContributor: statsSource.reduce<{ name: string; ars: number } | null>((top, q) => {");
    expect(manageQuotes).toContain("return !top || ars > top.ars ? { name: q.projectName, ars } : top;");
    expect(manageQuotes).toContain("detail={stats.topValueContributor ? `Mayor: ${stats.topValueContributor.name}");
  });
  // ── GEN-18 · Deshacer una receta elegida por error ───────────────────────
  it("permite quitar la receta seleccionada, simétrico a lo que applyDefinition escribe", () => {
    // Reporte real, con captura: "aca seleccione bolsa de creditos por
    // error, quiero des-seleccionar y no anda". Clickear la tarjeta ya
    // activa sólo volvía a aplicar la misma receta -- no había ningún
    // camino para deshacer la elección.
    const builder = source("client/src/components/quotation/professional-scope-builder.tsx");
    expect(builder).toContain("const clearBlueprintSelection = () => {");
    expect(builder).toContain("Quitar selección");
    // Deshace exactamente lo que applyDefinition escribe: id, versión,
    // snapshot, equipo, entregables y el plan operativo -- no un subconjunto.
    const clearFn = builder.slice(
      builder.indexOf("const clearBlueprintSelection = () => {"),
      builder.indexOf("// Los grupos de propuestas creados desde el brief"),
    );
    expect(clearFn).toContain("serviceBlueprintId: null,");
    expect(clearFn).toContain("scopeSnapshot: null,");
    expect(clearFn).toContain("updateTeamMembers([]);");
    expect(clearFn).toContain('project: { ...quotationData.project, type: "", duration: "" },');
    // La Bolsa de créditos se apaga sin perder los valores ya cargados,
    // igual que updateProjectType al cambiar de modalidad.
    expect(clearFn).toContain("enabled: false }");
    // No reaplica la receta al volver a montar: el efecto de auto-apply no
    // debe disparar de nuevo con el id que se acaba de limpiar.
    expect(clearFn).toContain("autoAppliedBlueprintId.current = null;");
  });
});