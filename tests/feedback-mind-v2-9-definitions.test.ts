import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { productDefinitionsMarkdown } from "../server/content/product-definitions.generated";
import { PRODUCT_DEFINITIONS_MANIFEST } from "../server/content/product-definitions-manifest";
import { PRODUCT_DEFINITIONS_RELEASES } from "../server/content/product-definitions-releases";

const expectedIds = [
  ...Array.from({ length: 7 }, (_, index) => `CFG-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 16 }, (_, index) => `COT-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 12 }, (_, index) => `PRO-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 26 }, (_, index) => `TAR-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 8 }, (_, index) => `OPS-${String(index + 1).padStart(2, "0")}`),
  "FIN-01",
];

describe("Feedback Mind V2-9 product definitions contract", () => {
  it("contains every one of the 70 feedback IDs exactly once in the status table", () => {
    const tableIds = Array.from(productDefinitionsMarkdown.matchAll(/^\| ((?:CFG|COT|PRO|TAR|OPS|FIN)-\d{2}) \|/gm), match => match[1]);
    expect(tableIds).toHaveLength(70);
    expect(new Set(tableIds).size).toBe(70);
    expect([...tableIds].sort()).toEqual([...expectedIds].sort());
  });

  it("keeps the explicit version and SHA-256 manifest synchronized", () => {
    expect(productDefinitionsMarkdown).toContain(`version: ${PRODUCT_DEFINITIONS_MANIFEST.version}`);
    expect(productDefinitionsMarkdown).toContain(`updatedAt: ${PRODUCT_DEFINITIONS_MANIFEST.updatedAt}`);
    expect(createHash("sha256").update(productDefinitionsMarkdown).digest("hex"))
      .toBe(PRODUCT_DEFINITIONS_MANIFEST.sha256);
    expect(PRODUCT_DEFINITIONS_RELEASES[PRODUCT_DEFINITIONS_MANIFEST.version])
      .toBe(PRODUCT_DEFINITIONS_MANIFEST.sha256);
  });

  it("preserves the exact original subject assigned to every feedback ID", () => {
    const definitionById = new Map(
      Array.from(
        productDefinitionsMarkdown.matchAll(/^\| ((?:CFG|COT|PRO|TAR|OPS|FIN)-\d{2}) \| [^|]+ \| ([^|]+) \|$/gm),
        (match) => [match[1], match[2].trim()],
      ),
    );
    const requiredSubject: Record<string, RegExp> = {
      "CFG-01": /Máster.*Personal.*Cotizaciones/i,
      "CFG-02": /Refrescar Datos/i,
      "CFG-03": /sueldo.*valor hora.*horas/i,
      "CFG-04": /tabla mensual/i,
      "CFG-05": /pasados.*futuros/i,
      "CFG-06": /Rol vigente.*Subnivel.*freelancers.*Rol Viejo/i,
      "CFG-07": /Valor hora estimada.*Configuración > Personal/i,
      "COT-01": /Proyección de tarifas.*selector/i,
      "COT-02": /tarifas.*historial.*USD.*mixtos/i,
      "COT-03": /errores.*sin.*parcialmente insertados/i,
      "COT-04": /lista.*carpetas Cliente > Proyecto/i,
      "COT-05": /Información básica.*centrada/i,
      "COT-06": /Mes salarial.*Proyección.*centrados/i,
      "COT-07": /integrante.*centrada/i,
      "COT-08": /KPIs.*escenario\/moneda.*Gestión/i,
      "COT-09": /Foto del mes seleccionado.*Promedio anual estimado/i,
      "COT-10": /moneda al comienzo/i,
      "COT-11": /tipo de cambio.*comienzo/i,
      "COT-12": /Eliminar la segunda selección/i,
      "COT-13": /USD.*coma decimal.*ARS/i,
      "COT-14": /escenarios.*comparativa.*revisión.*resumen.*payload/i,
      "COT-15": /markup.*variantes.*revisión.*resumen/i,
      "COT-16": /cotización finalizada.*approved.*proyecto/i,
      "PRO-01": /proyectos internos.*Epical/i,
      "PRO-02": /Sólo con actividad/i,
      "PRO-03": /proyectos nuevos activos/i,
      "PRO-04": /enero/i,
      "PRO-05": /único lugar.*Vista de proyectos/i,
      "PRO-06": /estado.*Vista de proyectos.*Tareas/i,
      "PRO-07": /Cliente > Proyecto.*lista\/carpeta/i,
      "PRO-08": /Colaboradores.*activos asignados.*Operaciones/i,
      "PRO-09": /Ops\/Admin.*active-projects.*colaboradores.*tasks\/projects/i,
      "PRO-10": /costo.*horas.*altas.*ediciones.*bajas/i,
      "PRO-11": /actividad.*Tareas.*proyecto/i,
      "PRO-12": /Evaluar retirar.*actividad/i,
      "TAR-01": /Tareas que asigné/i,
      "TAR-02": /horas propias.*semana.*mes/i,
      "TAR-03": /tareas raíz.*proyecto.*sección/i,
      "TAR-04": /Home.*Mis tareas.*Calendario/i,
      "TAR-05": /Calendario.*sólo lectura/i,
      "TAR-06": /Inicio.*fin.*período/i,
      "TAR-07": /horas.*falte costo histórico/i,
      "TAR-08": /estimaciones semanales/i,
      "TAR-09": /Responsables.*colaboradores.*miembros/i,
      "TAR-10": /único editor de estado/i,
      "TAR-11": /rentabilidad/i,
      "TAR-12": /miembros del proyecto/i,
      "TAR-13": /presets.*manual.*temporizador/i,
      "TAR-14": /gráfico mensual.*tareas sin horas/i,
      "TAR-15": /proyecto.*fila/i,
      "TAR-16": /Próxima\/En curso\/Vencida/i,
      "TAR-17": /tercero.*atribución/i,
      "TAR-18": /solo reloj.*resumen/i,
      "TAR-19": /editar horas.*fecha.*descripción/i,
      "TAR-20": /ProjectOverviewPanel.*única fuente/i,
      "TAR-21": /gráfico.*márgenes responsivos/i,
      "TAR-22": /completedAt.*semana civil/i,
      "TAR-23": /checklist.*tareas.*subtareas/i,
      "TAR-24": /prioridad.*inline/i,
      "TAR-25": /Por sección/i,
      "TAR-26": /Equipo del proyecto.*miembros reales/i,
      "OPS-01": /Panel de horas.*Tareas/i,
      "OPS-02": /Capacidad.*estimaciones semanales/i,
      "OPS-03": /Cierre mensual.*terceros/i,
      "OPS-04": /Día Epical/i,
      "OPS-05": /feriados.*duplicados/i,
      "OPS-06": /feriados.*capacidad.*doble descuento/i,
      "OPS-07": /eliminar un status/i,
      "OPS-08": /Autoservicio de ausencias.*aprobación\/rechazo.*saldos/i,
      "FIN-01": /Activo\/Pasivo.*ARS\/USD/i,
    };
    expect(Object.keys(requiredSubject)).toHaveLength(70);
    for (const [id, subject] of Object.entries(requiredSubject)) {
      expect(definitionById.get(id), id).toMatch(subject);
    }
  });

  it("leaves only the two authorized deferred decisions", () => {
    const deferredRows = Array.from(productDefinitionsMarkdown.matchAll(/^\| ([A-Z]+-\d{2}) \| Diferido \|/gm), match => match[1]);
    expect(deferredRows).toEqual(["PRO-12", "TAR-16"]);
  });
});
