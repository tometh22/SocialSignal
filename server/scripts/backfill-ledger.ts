/**
 * Backfill manual de Activo/Pasivo desde el Excel MAESTRO.
 *
 * Mismo camino que POST /api/ledger/backfill (server/routes-ledger.ts) — llama
 * a las mismas funciones que usa el cron de autoSyncService, sin parsing nuevo.
 * Existe como script porque este endpoint es admin-only y en este momento no
 * hay forma de autenticar una sesión admin contra prod desde acá; se ejecuta
 * con `railway run` para tomar DATABASE_URL y las credenciales de Google
 * Sheets del entorno real, sin necesitar login.
 *
 * Idempotente: importActivoEntries/importPasivoEntries borran y reinsertan
 * sólo las filas con overrideManual=false de cada período — nunca tocan
 * filas cargadas a mano en Mind.
 *
 * Ejecutar con: tsx server/scripts/backfill-ledger.ts --from=2026-01 --to=2026-09
 */
import { storage } from "../storage";
import { googleSheetsWorkingService } from "../services/googleSheetsWorking";

function periodsBetween(from: string, to: string): string[] {
  const periods: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [toY, toM] = to.split("-").map(Number);
  while (y < toY || (y === toY && m <= toM)) {
    periods.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return periods;
}

async function main() {
  const from = process.argv.find((a) => a.startsWith("--from="))?.split("=")[1];
  const to = process.argv.find((a) => a.startsWith("--to="))?.split("=")[1];
  if (!from || !to || !/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) {
    console.error("Uso: tsx server/scripts/backfill-ledger.ts --from=YYYY-MM --to=YYYY-MM");
    process.exit(1);
  }

  const periods = periodsBetween(from, to);
  console.log(`🔄 Backfill Activo/Pasivo: ${periods.join(", ")}`);

  const summary: Record<string, any> = {};
  for (const period of periods) {
    const [activo, pasivo] = await Promise.allSettled([
      googleSheetsWorkingService.importActivoEntries(storage, period),
      googleSheetsWorkingService.importPasivoEntries(storage, period),
    ]);
    const activoResult = activo.status === "fulfilled" ? activo.value : { errors: [String(activo.reason)] };
    const pasivoResult = pasivo.status === "fulfilled" ? pasivo.value : { errors: [String(pasivo.reason)] };
    summary[period] = { activo: activoResult, pasivo: pasivoResult };
    console.log(`  ${period} → activo: ${JSON.stringify(activoResult)} | pasivo: ${JSON.stringify(pasivoResult)}`);
  }

  console.log("✅ Backfill terminado.");
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Backfill falló:", err);
    process.exit(1);
  });
