import { autoSyncService } from "./autoSyncService";
import { startFinancialIntakeWorker } from "./financial-intake-queue";
import { startUserNotificationEmailWorker } from "./user-notifications";

export async function startBackgroundJobs() {
  const stopEmails = startUserNotificationEmailWorker();
  const stopIntake = startFinancialIntakeWorker();
  // Start automatic synchronization service (Excel/Google Sheets → ledger/cashflow).
  // Re-enabled per ops request. Guarded so a missing Google Sheets credential or a
  // sync failure can't crash startup. Set DISABLE_AUTO_SYNC=true to turn it off.
  const backgroundSyncDisabled = process.env.DISABLE_AUTO_SYNC === "true";
  if (backgroundSyncDisabled) {
    console.log("⏸️  Sincronizaciones y jobs externos deshabilitados por DISABLE_AUTO_SYNC=true");
  } else {
    try {
      autoSyncService.start();
      console.log("🔄 Sincronización automática iniciada (cada 30 minutos)");
    } catch (e: any) {
      console.error("⚠️  No se pudo iniciar el auto-sync:", e?.message);
    }

    // Lightweight Resumen Ejecutivo sync (every 2 hours + on startup)
    const { startResumenEjecutivoSync } = await import("../jobs/resumen-ejecutivo-sync");
    startResumenEjecutivoSync();
    console.log("📊 Resumen Ejecutivo auto-sync iniciado (cada 2 horas)");

    // Full SoT pipeline sync — every 6 hours, also runs 60s after startup
    const { startDailySoTSync } = await import("../jobs/daily-sot-sync");
    startDailySoTSync();
    console.log("📅 [SoT Sync] Pipeline completo programado cada 6 horas");

    // Start CRM reminder notifications job
    const { startReminderNotifications } = await import("../jobs/reminder-notifications");
    startReminderNotifications();
    console.log("🔔 Job de notificaciones de recordatorios CRM iniciado");

    // IPC sync (API pública ArgentinaDatos) + detección de ajustes de
    // precio vencidos para contratos recurrentes en ARS. Sólo deja
    // propuestas "pending_approval" — nunca cambia un precio ni manda un
    // email sin aprobación explícita.
    const { startIpcPriceAdjustmentsJob } = await import("../jobs/ipc-price-adjustments");
    startIpcPriceAdjustmentsJob();
    console.log("📈 Job de ajuste de precio por IPC iniciado (diario)");
  }

  if (process.env.DISABLE_TEAM_PAYROLL !== "true") {
    const { startTeamPayroll } = await import("../jobs/team-payroll");
    startTeamPayroll();
  }

  const { startQuotationExpirationJob } = await import("../jobs/quotation-expiration");
  startQuotationExpirationJob();
  console.log("📨 Job de vencimiento de cotizaciones iniciado");

  return async () => { stopEmails(); autoSyncService.stop(); await stopIntake(); };
}
