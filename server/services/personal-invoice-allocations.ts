export type PersonalInvoiceProject = {
  projectId: number;
  projectName: string;
  clientName: string | null;
  hours: number;
  computedCostARS: number;
};

export type PersonalInvoiceAllocation = PersonalInvoiceProject & {
  allocationPercent: number;
  computedCostUSD: number;
  allocatedInvoiceAmount: number | null;
  invoiceCurrency: "ARS" | "USD" | null;
};

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Distribuye una factura entre los proyectos efectivamente trabajados.
 * Priorizamos el costo histórico como ponderador y usamos horas sólo si el
 * período todavía no tiene costos calculados. El último renglón absorbe los
 * centavos de redondeo para que porcentajes e importe siempre cierren.
 */
export function buildPersonalInvoiceAllocations(input: {
  projects: PersonalInvoiceProject[];
  selectedProjectIds?: number[];
  computedTotalUSD: number;
  invoiceAmount?: number | null;
  invoiceCurrency?: "ARS" | "USD" | null;
}): PersonalInvoiceAllocation[] {
  const selected = input.selectedProjectIds?.length
    ? new Set(input.selectedProjectIds)
    : null;
  const projects = input.projects.filter((project) => !selected || selected.has(project.projectId));
  if (!projects.length) return [];

  const totalCost = projects.reduce((sum, project) => sum + Math.max(0, project.computedCostARS), 0);
  const totalHours = projects.reduce((sum, project) => sum + Math.max(0, project.hours), 0);
  const weight = (project: PersonalInvoiceProject) => totalCost > 0
    ? Math.max(0, project.computedCostARS) / totalCost
    : totalHours > 0 ? Math.max(0, project.hours) / totalHours : 1 / projects.length;

  let usedPercent = 0;
  let usedUsd = 0;
  let usedInvoice = 0;
  return projects.map((project, index) => {
    const last = index === projects.length - 1;
    const allocationPercent = last ? round(100 - usedPercent, 4) : round(weight(project) * 100, 4);
    const computedCostUSD = last
      ? round(Math.max(0, input.computedTotalUSD) - usedUsd)
      : round(Math.max(0, input.computedTotalUSD) * allocationPercent / 100);
    const allocatedInvoiceAmount = input.invoiceAmount == null ? null : last
      ? round(Math.max(0, input.invoiceAmount) - usedInvoice)
      : round(Math.max(0, input.invoiceAmount) * allocationPercent / 100);
    usedPercent += allocationPercent;
    usedUsd += computedCostUSD;
    usedInvoice += allocatedInvoiceAmount ?? 0;
    return {
      ...project,
      allocationPercent,
      computedCostUSD,
      allocatedInvoiceAmount,
      invoiceCurrency: input.invoiceCurrency ?? null,
    };
  });
}
