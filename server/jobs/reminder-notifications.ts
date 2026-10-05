/**
 * Convierte recordatorios CRM próximos o vencidos en avisos de Mind.
 * La entrega por email la resuelve el worker de Resend según las preferencias
 * de cada destinatario.
 */

import cron from "node-cron";
import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "../db";
import { crmLeads, crmReminders } from "@shared/schema";
import { createUserNotifications } from "../services/user-notifications";

async function enqueueDueReminderNotifications() {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dueReminders = await db.select({
      id: crmReminders.id,
      description: crmReminders.description,
      dueDate: crmReminders.dueDate,
      leadId: crmReminders.leadId,
      createdBy: crmReminders.createdBy,
      assignedTo: crmLeads.assignedTo,
      leadName: crmLeads.companyName,
    }).from(crmReminders)
      .innerJoin(crmLeads, eq(crmLeads.id, crmReminders.leadId))
      .where(and(
        eq(crmReminders.completed, false),
        isNull(crmReminders.notifiedAt),
        lte(crmReminders.dueDate, in24h),
      ));

    for (const reminder of dueReminders) {
      const recipients = [...new Set([reminder.createdBy, reminder.assignedTo]
        .filter((id): id is number => typeof id === "number" && id > 0))];
      if (!recipients.length) continue;

      const overdue = reminder.dueDate < now;
      const leadName = reminder.leadName || `Lead #${reminder.leadId}`;
      const saved = await createUserNotifications(recipients, {
        eventKey: `crm-reminder:${reminder.id}`,
        type: "crm_reminder",
        title: overdue ? "Recordatorio CRM vencido" : "Recordatorio CRM próximo",
        message: `${leadName}: ${reminder.description}`,
        entityType: "crm_lead",
        entityId: reminder.leadId,
        actionUrl: `/crm/${reminder.leadId}`,
      });
      if (!saved) continue;
      await db.update(crmReminders).set({ notifiedAt: now }).where(eq(crmReminders.id, reminder.id));
    }
  } catch (error) {
    console.error("No se pudieron procesar los recordatorios CRM:", error instanceof Error ? error.message : error);
  }
}

export function startReminderNotifications() {
  console.log("🔔 Programando avisos de recordatorios CRM (cada hora)...");
  cron.schedule("0 * * * *", enqueueDueReminderNotifications);
  void enqueueDueReminderNotifications();
}
