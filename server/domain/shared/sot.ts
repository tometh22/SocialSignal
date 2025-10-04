import { db } from "../../db";
import { incomeSot, costsSot } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function getIncomeRows(period: string, _opts?: { fresh?: boolean }) {
  const rows = await db.query.incomeSot.findMany({
    where: eq(incomeSot.monthKey, period)
  });
  
  return rows.map(r => ({
    projectKey: r.projectKey,
    currency: (r.currencyNative as "ARS" | "USD") ?? "ARS",
    revenueDisplay: Number(r.revenueDisplay ?? 0) / 100, // Fix ×100 bug
    revenueUSD: Number(r.revenueUsd ?? 0) / 100, // Fix ×100 bug
    flags: r.flags ?? []
  }));
}

export async function getCostRows(period: string, _opts?: { fresh?: boolean }) {
  const rows = await db.query.costsSot.findMany({
    where: eq(costsSot.monthKey, period)
  });
  
  return rows.map(r => ({
    projectKey: r.projectKey,
    currency: (r.currencyNative as "ARS" | "USD") ?? "ARS",
    costDisplay: Number(r.costDisplay ?? 0) / 100, // Fix ×100 bug
    costUSD: Number(r.costUsd ?? 0) / 100, // Fix ×100 bug
    flags: r.flags ?? []
  }));
}
