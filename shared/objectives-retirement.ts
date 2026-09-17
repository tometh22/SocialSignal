// El plan guardó 87 entradas como "objetivo". Revisándolas una por una,
// quince no lo son: nueve repiten a nivel persona algo que ya está dicho a
// nivel área, y seis más siete son tareas con fecha, no metas.
//
// No se borran. Quedan en la base con su historial y su avance; sólo dejan de
// contarse y de mostrarse como objetivos. Si mañana alguna vuelve a ser un
// objetivo, se saca de acá y reaparece.

export type RetirementReason = "duplicado" | "es-una-accion";

export const RETIRED_OBJECTIVES: Record<string, { reason: RetirementReason; note: string }> = {
  // Nueve objetivos de persona que repiten al de área del que cuelgan. Lo
  // único que aportaban era el nombre del responsable, que ya es un campo.
  "person-sil-target-list": { reason: "duplicado", note: "Repite 'Cerrar la lista de clientes ideales'" },
  "person-sil-vertical-messaging": { reason: "duplicado", note: "Repite 'Construir secuencias por vertical'" },
  "person-sil-meetings-and-losses": { reason: "duplicado", note: "Repite 'Entregar reuniones calificadas'" },
  "person-santi-demand-channels": { reason: "duplicado", note: "Repite 'Lanzar Google Ads sobre el Radar'" },
  "person-santi-cases-and-frontier": { reason: "duplicado", note: "Repite 'Convertir evidencia en casos escritos'" },
  "person-santi-qualified-leads": { reason: "duplicado", note: "Repite 'Entregar contactos con interés real a Sales'" },
  "person-acha-process-improvement": { reason: "duplicado", note: "Repite 'Automatizar o mejorar un proceso'" },
  "person-pms-expansion-detection": { reason: "duplicado", note: "Repite 'Realizar reuniones de expansión'" },

  // Siete tareas con fecha y dueño que estaban anotadas como objetivos. Pasan
  // a ser acciones semanales, que es el vehículo para llegar a un objetivo.
  "area-operations-coelsa-retention": { reason: "es-una-accion", note: "Ahora es la acción sep-w3-vicky-coelsa-retention" },
  "area-product-radar-cuts": { reason: "es-una-accion", note: "Ahora es la acción sep-w4-tomas-radar-cuts" },
  "area-product-paid-diagnosis": { reason: "es-una-accion", note: "Ahora es la acción sep-w4-tomas-paid-diagnosis" },
  "area-product-alerts": { reason: "es-una-accion", note: "Ahora es la acción oct-w3-tomas-alerts-product" },
  "area-product-dashboard": { reason: "es-una-accion", note: "Ahora es la acción oct-w5-tomas-agentic-dashboard" },
  "area-product-mind-pilot": { reason: "es-una-accion", note: "Ahora es la acción sep-w4-vicky-mind-quote" },
  "person-acha-radar-relaunch": { reason: "es-una-accion", note: "Ahora es la acción sep-w3-acha-radar-relaunch" },
};

export function isRetired(slug: string | null | undefined): boolean {
  return slug != null && slug in RETIRED_OBJECTIVES;
}
