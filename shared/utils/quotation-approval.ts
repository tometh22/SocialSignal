export function canDecideQuotationApproval(user: { id: number; isAdmin?: boolean | null; role?: string | null; permissions?: string[] | null } | null | undefined, requestedBy?: number | null): boolean {
  return Boolean(user && user.id !== requestedBy && (user.isAdmin || user.role === "admin" || user.permissions?.some(permission => ["operations", "quotations_approve"].includes(permission))));
}

export function approvalRevisionIsCurrent(approval: { revisionId: number }, latest: { id: number } | null | undefined): boolean {
  return Boolean(latest && approval.revisionId === latest.id);
}

export function quotationApprovalGuidance(status: string): string {
  switch (status) {
    case "draft": return "Primero solicitá la aprobación interna. Si hay reglas pendientes, otra persona con permiso de aprobación debe resolverlas en esta pantalla.";
    case "pending": return "Paso 1: aprobación interna. Una persona autorizada distinta de quien la solicitó debe aprobar las reglas pendientes.";
    case "internally-approved": return "Paso 2: enviá la propuesta al cliente. La aprobación interna ya está completa; falta la aceptación del cliente. Podés enviar la propuesta o registrar una etapa que ya ocurrió fuera de Mind.";
    case "sent": case "viewed": case "in-negotiation": return "Paso 3: aceptación del cliente. El cliente debe abrir el enlace recibido y aceptar la propuesta (y elegir una alternativa si corresponde). Esa decisión registra la aprobación final. Si ya aceptó por otro canal, usá Registrar etapa.";
    case "approved": return "Aprobación final registrada. La aceptación del cliente y la revisión aceptada se conservan en el historial comercial.";
    default: return "Para retomar esta propuesta, creá una nueva revisión y recorré nuevamente la aprobación interna y la aceptación del cliente.";
  }
}
