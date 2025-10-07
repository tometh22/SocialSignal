import { db } from "../../db";
import { incomeSot, costsSot } from "@shared/schema";
import { eq } from "drizzle-orm";
import { canon } from "../../utils/normalize";

/**
 * Generar projectKey desde clientName y projectName
 */
function generateProjectKey(clientName: string, projectName: string): string {
  return `${canon(clientName)}|${canon(projectName)}`;
}

/**
 * Determinar moneda nativa para display según reglas:
 * - Si Moneda Original ARS > 0 → ARS
 * - Si Moneda Original USD > 0 → USD  
 * - Default → USD
 */
function getNativeDisplayCurrency(amountLocalArs: number | null, amountLocalUsd: number | null): "ARS" | "USD" {
  const ars = Number(amountLocalArs ?? 0);
  const usd = Number(amountLocalUsd ?? 0);
  
  if (ars > 0) return "ARS";
  if (usd > 0) return "USD";
  return "USD";
}

/**
 * Obtener monto display nativo según moneda
 */
function getNativeDisplayAmount(currency: "ARS" | "USD", amountLocalArs: number | null, amountLocalUsd: number | null): number {
  if (currency === "ARS") return Number(amountLocalArs ?? 0);
  return Number(amountLocalUsd ?? 0);
}

export async function getIncomeRows(period: string, _opts?: { fresh?: boolean }) {
  const rows = await db.query.incomeSot.findMany({
    where: eq(incomeSot.monthKey, period)
  });
  
  return rows.map(r => {
    const projectKey = generateProjectKey(r.clientName, r.projectName);
    const currency = getNativeDisplayCurrency(Number(r.amountLocalArs), Number(r.amountLocalUsd));
    const revenueDisplay = getNativeDisplayAmount(currency, Number(r.amountLocalArs), Number(r.amountLocalUsd));
    
    return {
      projectKey,
      clientName: r.clientName,
      projectName: r.projectName,
      projectType: r.projectType,
      currency,
      revenueDisplay,
      revenueUSD: Number(r.revenueUsd ?? 0),
      flags: []
    };
  });
}

export async function getCostRows(period: string, _opts?: { fresh?: boolean }) {
  const rows = await db.query.costsSot.findMany({
    where: eq(costsSot.monthKey, period)
  });
  
  return rows.map(r => ({
    projectKey: r.projectKey,
    currency: (r.currencyNative as "ARS" | "USD") ?? "ARS",
    costDisplay: Number(r.costDisplay ?? 0),
    costUSD: Number(r.costUsd ?? 0),
    flags: r.flags ?? []
  }));
}
