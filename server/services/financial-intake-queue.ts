import { and, eq, sql } from "drizzle-orm";
import { pool, db } from "../db";
import { financialIntakeItems } from "@shared/schema";
import { extractFinancialIntake } from "./financial-intake-extractor";
import { readFinancialIntakeFile } from "./financial-intake-files";

let active: Promise<void> | null = null;
let stopping = false;

export async function processFinancialIntakeQueue() {
  if (stopping || active) return active;
  active = (async () => {
    // A crashed worker's lease is reclaimed. SDK requests time out well before 15 minutes.
    const claimed = await pool.query(`WITH candidate AS (
      SELECT id FROM financial_intake_items
      WHERE status='received' OR (status='processing' AND updated_at < now()-interval '15 minutes')
      ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1
    ) UPDATE financial_intake_items item SET status='processing',extraction_error=NULL,updated_at=date_trunc('milliseconds',now())
      FROM candidate WHERE item.id=candidate.id RETURNING item.id,item.updated_at::text AS lease`);
    const lease = claimed.rows[0];
    if (!lease) return;
    const [item] = await db.select().from(financialIntakeItems).where(eq(financialIntakeItems.id, lease.id));
    const ownership = and(eq(financialIntakeItems.id, lease.id), eq(financialIntakeItems.status, "processing"), sql`${financialIntakeItems.updatedAt}=${lease.lease}::timestamp`);
    try {
      const file = item.storageKey ? await readFinancialIntakeFile(item.storageKey) : null;
      const extraction = await extractFinancialIntake({ text: item.originalText,
        file: file ? { buffer: file, mimeType: item.mimeType || "application/octet-stream", fileName: item.originalFileName || "documento" } : null });
      await db.update(financialIntakeItems).set({ status: "needs_review", documentKind: extraction.data.documentKind,
        suggestedTarget: extraction.data.suggestedTarget, extractedData: extraction.data, fieldConfidence: extraction.data.fieldConfidence,
        warnings: extraction.data.warnings, extractorProvider: extraction.provider, extractorModel: extraction.model,
        extractorVersion: extraction.version, updatedAt: new Date() }).where(ownership);
    } catch (error) {
      console.error("Financial extraction failed", error);
      await db.update(financialIntakeItems).set({ status: "failed", extractionError: "No se pudo interpretar el documento. Podés reintentar o completar el borrador.", updatedAt: new Date() }).where(ownership);
    }
  })().finally(() => { active = null; });
  return active;
}

export function startFinancialIntakeWorker() {
  stopping = false;
  const run = () => void processFinancialIntakeQueue().catch(error => console.error("Intake worker failed", error));
  const timer = setInterval(run, 2000); timer.unref(); run();
  return async () => { stopping = true; clearInterval(timer); await active; };
}
