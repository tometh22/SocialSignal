// Los estados viajan desde la base en inglés ("draft", "in_progress"). Varias
// pantallas los pintaban crudos, así que la interfaz mezclaba idiomas. Este
// mapa único traduce cualquiera de ellos; si aparece uno nuevo devuelve el
// valor original, que es preferible a esconderlo.
const STATUS_LABELS: Record<string, string> = {
  // Proyectos
  active: "Activo",
  paused: "Pausado",
  "on-hold": "En pausa",
  on_hold: "En pausa",
  completed: "Completado",
  complete: "Completado",
  finished: "Terminado",
  delivered: "Entregado",
  invoiced: "Facturado",
  voided: "Anulado",
  archived: "Archivado",
  cancelled: "Cancelado",
  canceled: "Cancelado",
  closed: "Cerrado",
  inactive: "Inactivo",

  // Cotizaciones y propuestas
  draft: "Borrador",
  submitted: "Enviada",
  sent: "Enviada",
  pending: "Pendiente",
  pending_approval: "Pendiente de aprobación",
  approved: "Aprobada",
  rejected: "Rechazada",
  "in-negotiation": "En negociación",
  in_negotiation: "En negociación",
  accepted: "Aceptada",
  expired: "Vencida",
  ready: "Lista",
  published: "Publicada",
  proposed: "Propuesta",

  // Tareas, acciones y controles
  todo: "Por hacer",
  planned: "Planificada",
  not_started: "Sin empezar",
  in_progress: "En curso",
  "in-progress": "En curso",
  blocked: "Bloqueada",
  at_risk: "En riesgo",
  done: "Completada",
  queued: "En cola",
  running: "En ejecución",
  failed: "Falló",
  ok: "OK",
  upcoming: "Próxima",
  resolved: "Resuelta",

  // Circuito comercial de la cotización
  "internally-approved": "Aprobada internamente",
  internally_approved: "Aprobada internamente",
  viewed: "Vista",
  superseded: "Reemplazada",
  bounced: "Rebotada",

  // Cierre financiero: severidad y estado de cada control
  info: "Informativo",
  warning: "Advertencia",
  critical: "Crítico",
  error: "Error",
  passed: "Pasó",
  open: "Abierto",
};

export function statusLabel(status: string | null | undefined, fallback = "Sin estado"): string {
  if (!status) return fallback;
  const key = status.trim().toLowerCase();
  return STATUS_LABELS[key] ?? STATUS_LABELS[key.replace(/[\s-]+/g, "_")] ?? status;
}
