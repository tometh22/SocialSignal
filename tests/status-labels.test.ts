import { describe, expect, it } from "vitest";
import { statusLabel } from "../client/src/lib/status-labels";
import { OBJECTIVE_ACTION_STATUSES } from "@shared/schema";

// Los estados llegan de la base en inglés. Si a uno le falta traducción, la
// pantalla lo pinta crudo: así fue como los 87 objetivos y las 60 acciones
// mostraban "planned" en una interfaz en castellano.
const IS_SPANISH = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/;

describe("statusLabel", () => {
  it("traduce todos los estados de las acciones de objetivos", () => {
    for (const status of OBJECTIVE_ACTION_STATUSES) {
      const label = statusLabel(status);
      expect(label, `falta traducir "${status}"`).not.toBe(status);
      expect(label).toMatch(IS_SPANISH);
    }
  });

  it("traduce los estados de proyectos y cotizaciones", () => {
    const statuses = [
      "active", "completed", "cancelled", "on-hold", "delivered", "invoiced", "voided",
      "draft", "pending", "approved", "rejected", "in-negotiation",
    ];
    for (const status of statuses) {
      expect(statusLabel(status), `falta traducir "${status}"`).not.toBe(status);
    }
  });

  it("acepta mayúsculas, espacios y guiones", () => {
    expect(statusLabel("PLANNED")).toBe("Planificada");
    expect(statusLabel("In Progress")).toBe("En curso");
    expect(statusLabel("on-hold")).toBe("En pausa");
  });

  it("usa el texto de reemplazo cuando no hay estado", () => {
    expect(statusLabel(null)).toBe("Sin estado");
    expect(statusLabel("", "Activo")).toBe("Activo");
  });

  it("devuelve el valor original ante un estado desconocido en vez de ocultarlo", () => {
    expect(statusLabel("flujo_nuevo")).toBe("flujo_nuevo");
  });
});
