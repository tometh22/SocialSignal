/**
 * Diagnóstico de Mind — ajustes de datos de personas.
 *
 * - Ali Crosa y Sandra Alice facturan en USD → billingCurrency = 'USD'.
 * - Sol no debe aparecer en cotizaciones a partir de mayo 2026 → activeUntil = '2026-05-01'.
 *
 * Idempotente: matchea por nombre (case-insensitive, parcial) y solo escribe si cambia.
 * Ejecutar con: tsx server/scripts/fix-personnel-diagnostic.ts
 */
import { db } from "../db";
import { personnel } from "@shared/schema";
import { ilike, eq } from "drizzle-orm";

type Patch = { match: string; set: Partial<typeof personnel.$inferInsert>; label: string };

const PATCHES: Patch[] = [
  { match: "%ali%cros%", set: { billingCurrency: "USD" }, label: "Ali Crosa → billingCurrency=USD" },
  { match: "%sandra%", set: { billingCurrency: "USD" }, label: "Sandra Alice → billingCurrency=USD" },
  { match: "sol %", set: { activeUntil: "2026-05-01" }, label: "Sol → activeUntil=2026-05-01" },
];

async function main() {
  console.log("🔧 Ajustando datos de personas (Diagnóstico de Mind)...");
  for (const patch of PATCHES) {
    const rows = await db.select().from(personnel).where(ilike(personnel.name, patch.match));
    if (rows.length === 0) {
      console.warn(`⚠️  Sin coincidencias para "${patch.match}" (${patch.label}) — revisá el nombre en Admin.`);
      continue;
    }
    for (const row of rows) {
      const needsUpdate = Object.entries(patch.set).some(
        ([k, v]) => (row as any)[k] !== v
      );
      if (!needsUpdate) {
        console.log(`✓ ${row.name}: ya estaba correcto (${patch.label})`);
        continue;
      }
      await db.update(personnel).set(patch.set).where(eq(personnel.id, row.id));
      console.log(`✅ ${row.name}: ${patch.label}`);
    }
  }
  console.log("✅ Listo.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
