import Anthropic from "@anthropic-ai/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectSnapshot {
  projectId: number;
  clientName: string | null;
  quotationName: string | null;
  healthStatus: string | null;
  marginStatus: string | null;
  teamStrain: string | null;
  mainRisk: string | null;
  currentAction: string | null;
  nextMilestone: string | null;
  ownerName: string | null;
  decisionNeeded: string | null;
  hiddenFromWeekly: boolean | null;
  noteCount: number;
}

export interface WeeklySummaryResult {
  executiveSummary: string;
  highlights: { type: "risk" | "win" | "action" | "decision"; text: string }[];
  projectInsights: {
    projectId: number;
    clientName: string;
    insight: string;
    suggestedRisk?: string;
    suggestedAction?: string;
  }[];
  weeklyScore: number; // 0-100 overall health score
}

// ─── Service ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sos un analista de gestión de proyectos de una agencia digital.
Tu tarea es generar un resumen ejecutivo semanal basado en el estado de los proyectos activos.

Reglas:
- Escribí en español argentino (vos, tenés, etc.)
- Sé directo y accionable — el CEO lee esto en 30 segundos
- Priorizá los problemas sobre los éxitos
- Si un proyecto tiene healthStatus "rojo" o "amarillo", destacalo primero
- Si hay decisiones pendientes (decisionNeeded != "ninguna"), mencionalo explícitamente
- El weeklyScore es un número de 0-100 que refleja la salud general del portafolio
- Los highlights deben ser frases cortas (max 15 palabras cada una)
- Los insights por proyecto deben ser de 1-2 oraciones

Respondé SOLO con JSON válido (sin markdown, sin backticks) con esta estructura:
{
  "executiveSummary": "párrafo de 2-3 oraciones con el resumen general",
  "highlights": [
    { "type": "risk|win|action|decision", "text": "frase corta" }
  ],
  "projectInsights": [
    {
      "projectId": number,
      "clientName": "nombre",
      "insight": "observación o recomendación",
      "suggestedRisk": "sugerencia de riesgo si el campo está vacío (opcional)",
      "suggestedAction": "sugerencia de acción si el campo está vacío (opcional)"
    }
  ],
  "weeklyScore": number
}`;

export async function generateWeeklySummary(
  projects: ProjectSnapshot[]
): Promise<WeeklySummaryResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no está configurada");
  }

  const client = new Anthropic({ apiKey });

  // Build the project data for the prompt
  const visibleProjects = projects.filter((p) => !p.hiddenFromWeekly);
  const projectData = visibleProjects.map((p) => ({
    id: p.projectId,
    cliente: p.clientName || "(Sin cliente)",
    proyecto: p.quotationName || "(Sin nombre)",
    estado: p.healthStatus || "verde",
    margen: p.marginStatus || "medio",
    desgasteEquipo: p.teamStrain || "bajo",
    riesgoPrincipal: p.mainRisk || "(vacío)",
    accionEnCurso: p.currentAction || "(vacío)",
    proximoHito: p.nextMilestone || "(vacío)",
    owner: p.ownerName || "(sin asignar)",
    decisionNecesaria: p.decisionNeeded || "ninguna",
    cantNotas: p.noteCount,
  }));

  const stats = {
    total: visibleProjects.length,
    rojos: visibleProjects.filter((p) => p.healthStatus === "rojo").length,
    amarillos: visibleProjects.filter((p) => p.healthStatus === "amarillo")
      .length,
    verdes: visibleProjects.filter(
      (p) => !p.healthStatus || p.healthStatus === "verde"
    ).length,
    conDecisionPendiente: visibleProjects.filter(
      (p) => p.decisionNeeded && p.decisionNeeded !== "ninguna"
    ).length,
    sinOwner: visibleProjects.filter((p) => !p.ownerName).length,
    sinRiesgo: visibleProjects.filter((p) => !p.mainRisk).length,
  };

  const userMessage = `Estos son los proyectos activos esta semana:

ESTADÍSTICAS GENERALES:
${JSON.stringify(stats, null, 2)}

DETALLE POR PROYECTO:
${JSON.stringify(projectData, null, 2)}

Generá el resumen ejecutivo semanal.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No se recibió respuesta de texto de Claude");
  }

  try {
    const result = JSON.parse(textContent.text) as WeeklySummaryResult;
    return result;
  } catch (e) {
    console.error("Error parsing AI response:", textContent.text);
    throw new Error("Error al parsear la respuesta de IA");
  }
}
