import { db } from "../../db";
import { financialSot } from "@shared/schema";
import { eq } from "drizzle-orm";
import { canon } from "../../utils/normalize";

/**
 * Generar projectKey desde clientName y projectName
 */
function generateProjectKey(clientName: string, projectName: string): string {
  return `${canon(clientName)}|${canon(projectName)}`;
}

/**
 * Determinar moneda nativa para display según reglas de "Rendimiento Cliente":
 * - Warner/Kimberly → USD (regex: /warner|kimberly/i)
 * - Otros clientes → ARS
 */
function getNativeDisplayCurrency(clientName: string): "ARS" | "USD" {
  const isUsdClient = /warner|kimberly/i.test(clientName);
  return isUsdClient ? "USD" : "ARS";
}

/**
 * Obtener monto display nativo según moneda y FX
 */
function getNativeDisplayAmount(currency: "ARS" | "USD", amountUsd: number, fx: number): number {
  if (currency === "USD") return amountUsd;
  return amountUsd * fx; // ARS = USD * FX
}

export async function getIncomeRows(period: string, _opts?: { fresh?: boolean }) {
  const rows = await db.query.financialSot.findMany({
    where: eq(financialSot.monthKey, period)
  });
  
  return rows.map(r => {
    const projectKey = generateProjectKey(r.clientName, r.projectName);
    const currency = getNativeDisplayCurrency(r.clientName);
    const revenueUsd = Number(r.revenueUsd ?? 0);
    const fx = Number(r.fx ?? 1);
    const revenueDisplay = getNativeDisplayAmount(currency, revenueUsd, fx);
    
    return {
      projectKey,
      clientName: r.clientName,
      projectName: r.projectName,
      projectType: r.projectType,
      currency,
      revenueDisplay,
      revenueUSD: revenueUsd,
      flags: []
    };
  });
}

export async function getCostRows(period: string, _opts?: { fresh?: boolean }) {
  const rows = await db.query.financialSot.findMany({
    where: eq(financialSot.monthKey, period)
  });
  
  return rows.map(r => {
    const projectKey = generateProjectKey(r.clientName, r.projectName);
    const currency = getNativeDisplayCurrency(r.clientName);
    const costUsd = Number(r.costUsd ?? 0);
    const fx = Number(r.fx ?? 1);
    const costDisplay = getNativeDisplayAmount(currency, costUsd, fx);
    
    return {
      projectKey,
      currency,
      costDisplay,
      costUSD: costUsd,
      flags: []
    };
  });
}
