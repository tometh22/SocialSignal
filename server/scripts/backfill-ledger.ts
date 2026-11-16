/**
 * Sincronización manual del ledger desde el Máster (Activo, Pasivo, CashFlow y
 * Provisión pasivo).
 *
 * Mismo camino que POST /api/ledger/backfill y que el sync de cada 30 minutos:
 * syncMasterLedger sólo toca meses que todavía se informan desde el Máster
 * (finance-period-source), reescribe únicamente los meses que cambiaron y nunca
 * borra filas creadas en Mind. Se ejecuta con `railway run` para tomar
 * DATABASE_URL y las credenciales de Google Sheets del entorno real.
 *
 * Ejecutar con: tsx server/scripts/backfill-ledger.ts --from=2026-01 --to=2026-10
 */
import { syncMasterLedger } from "../services/master-ledger-sync";

async function main() {
  const from = process.argv.find((a) => a.startsWith("--from="))?.split("=")[1];
  const to = process.argv.find((a) => a.startsWith("--to="))?.split("=")[1];
  if (!from || !to || !/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) {
    console.error("Uso: tsx server/scripts/backfill-ledger.ts --from=YYYY-MM --to=YYYY-MM");
    process.exit(1);
  }
  const report = await syncMasterLedger({ from, to });
  console.log(JSON.stringify(report, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Sincronización falló:", err);
    process.exit(1);
  });
