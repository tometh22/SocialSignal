import { sql } from "drizzle-orm";
import { db } from "../db";
import { systemConfig } from "@shared/schema";
import { hoursCivilDate } from "@shared/utils/hours-reconciliation";

/** Persist with the hours mutation, including deletion of the last entry. */
export async function markTaskCostSyncPending(tx: Pick<typeof db, "insert" | "execute">, projectId: number, date: Date) {
  const period = hoursCivilDate(date).slice(0, 7);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"financial-period:" + period}))`);
  const configKey = `task_cost_sync:${period}:${projectId}`;
  await tx.insert(systemConfig).values({ configKey, configValue: 1, description: "Conciliación de horas pendiente" })
    .onConflictDoUpdate({ target: systemConfig.configKey, set: { configValue: 1 } });
}
