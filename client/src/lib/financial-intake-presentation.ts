export type FinancialIntakeDocumentKind =
  | "customer_invoice"
  | "customer_collection"
  | "supplier_invoice"
  | "supplier_payment"
  | "bank_statement"
  | "fee_confirmation"
  | "exchange_rate"
  | "inflation"
  | "tax_settlement"
  | "provision"
  | "unknown";

type IntakeImpact = {
  destinations: string[];
  description: (lineCount: number) => string;
};

const INTAKE_IMPACTS: Record<FinancialIntakeDocumentKind, IntakeImpact> = {
  customer_invoice: {
    destinations: ["Activo", "Ingresos"],
    description: () => "Crea la cuenta a cobrar y reconoce el ingreso, sin duplicar un fee ya informado.",
  },
  customer_collection: {
    destinations: ["Cashflow", "Activo"],
    description: () => "Registra el ingreso de dinero e intenta aplicarlo a la factura del cliente.",
  },
  supplier_invoice: {
    destinations: ["Pasivo", "Costos"],
    description: () => "Crea la cuenta a pagar y lleva el costo al proyecto, estructura o provisión elegida.",
  },
  supplier_payment: {
    destinations: ["Cashflow", "Pasivo"],
    description: () => "Registra el egreso e intenta aplicarlo a la factura del proveedor.",
  },
  bank_statement: {
    destinations: ["Cashflow"],
    description: (lineCount) => `Crea ${lineCount || "los"} movimiento${lineCount === 1 ? "" : "s"} del extracto y deja las excepciones para conciliar.`,
  },
  fee_confirmation: {
    destinations: ["Ingresos", "Proyección"],
    description: () => "Registra el fee confirmado y su período o curva de devengamiento.",
  },
  exchange_rate: {
    destinations: ["Variables económicas"],
    description: (lineCount) => lineCount > 0
      ? `Guarda ${lineCount} valor${lineCount === 1 ? "" : "es"} proyectado${lineCount === 1 ? "" : "s"} de REM.`
      : "Guarda el tipo de cambio real del período.",
  },
  inflation: {
    destinations: ["Variables económicas"],
    description: () => "Actualiza el IPC o inflación mensual usado por los cálculos financieros.",
  },
  tax_settlement: {
    destinations: ["Pasivo", "Resultado impositivo"],
    description: () => "Crea la obligación a pagar y el ajuste impositivo, sin duplicarlo como costo operativo.",
  },
  provision: {
    destinations: ["Provisiones"],
    description: () => "Crea una provisión propuesta para que Finanzas la revise y apruebe.",
  },
  unknown: {
    destinations: ["Pendiente de clasificar"],
    description: () => "Elegí el tipo de información para que Mind pueda mostrar y crear el destino correcto.",
  },
};

export function getFinancialIntakeImpact(kind: FinancialIntakeDocumentKind, lineCount = 0) {
  const impact = INTAKE_IMPACTS[kind];
  return {
    destinations: impact.destinations,
    description: impact.description(lineCount),
  };
}

const LINKED_RECORD_LABELS: Record<string, string> = {
  activo_entry: "Cuenta a cobrar",
  pasivo_entry: "Cuenta a pagar",
  cashflow_transaction: "Movimiento de Cashflow",
  financial_document_application: "Pago o cobro conciliado",
  revenue_event: "Ingreso reconocido",
  revenue_event_linked: "Factura vinculada al fee",
  exchange_rate: "Tipo de cambio",
  monthly_inflation: "Inflación mensual",
  provision_entry: "Provisión",
  provision_movement: "Movimiento de provisión",
  pl_adjustment: "Ajuste impositivo",
};

export function getLinkedRecordPresentation(type: string, kind: FinancialIntakeDocumentKind) {
  let href: string | null = null;
  if (type === "activo_entry") href = "/finance/activo";
  if (type === "pasivo_entry") href = "/finance/pasivo";
  if (type === "cashflow_transaction") href = "/finance/cashflow";
  if (type === "provision_entry" || type === "provision_movement") href = "/finance/provisions";
  if (type === "financial_document_application") {
    if (kind === "customer_collection") href = "/finance/activo";
    if (kind === "supplier_payment") href = "/finance/pasivo";
  }

  return {
    label: LINKED_RECORD_LABELS[type] ?? type.replaceAll("_", " "),
    href,
  };
}
