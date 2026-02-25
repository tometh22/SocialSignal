/**
 * Reminder Notifications Job
 * Runs every hour to send email alerts for CRM reminders that are due within 24 hours
 * or already overdue, and haven't been notified yet.
 */

import cron from 'node-cron';
import { db } from '../db';
import { crmReminders, crmLeads, users } from '@shared/schema';
import { eq, and, isNull, lte, sql } from 'drizzle-orm';

async function sendReminderEmails() {
  try {
    const sgApiKey = process.env.SENDGRID_API_KEY;
    if (!sgApiKey) {
      console.log('⚠️ [Reminders] SENDGRID_API_KEY no configurado — omitiendo notificaciones');
      return;
    }

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const dueReminders = await db
      .select({
        id: crmReminders.id,
        description: crmReminders.description,
        dueDate: crmReminders.dueDate,
        leadId: crmReminders.leadId,
        createdBy: crmReminders.createdBy,
        leadName: crmLeads.companyName,
        userEmail: users.email,
      })
      .from(crmReminders)
      .leftJoin(crmLeads, eq(crmLeads.id, crmReminders.leadId))
      .leftJoin(users, eq(users.id, crmReminders.createdBy))
      .where(
        and(
          eq(crmReminders.completed, false),
          isNull(crmReminders.notifiedAt),
          lte(crmReminders.dueDate, in24h)
        )
      );

    if (dueReminders.length === 0) {
      return;
    }

    console.log(`🔔 [Reminders] ${dueReminders.length} recordatorio(s) para notificar`);

    const sgMail = await import('@sendgrid/mail');
    sgMail.default.setApiKey(sgApiKey);

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@epical.digital';

    const allUsers = await db.select({ email: users.email, role: users.role }).from(users);
    const adminEmails = allUsers.filter(u => u.role === 'admin').map(u => u.email);

    for (const reminder of dueReminders) {
      const isOverdue = new Date(reminder.dueDate) < now;
      const hoursLeft = Math.round((new Date(reminder.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60));
      const leadName = reminder.leadName || `Lead #${reminder.leadId}`;
      const appUrl = process.env.APP_URL || 'http://localhost:5000';
      const leadUrl = `${appUrl}/crm/${reminder.leadId}`;

      const statusText = isOverdue
        ? `⚠️ VENCIDO hace ${Math.abs(hoursLeft)} hora${Math.abs(hoursLeft) !== 1 ? 's' : ''}`
        : `⏰ Vence en ${hoursLeft} hora${hoursLeft !== 1 ? 's' : ''}`;

      const subject = `🔔 Recordatorio CRM: ${leadName}`;
      const htmlBody = `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background: ${isOverdue ? '#fee2e2' : '#fef3c7'}; border-left: 4px solid ${isOverdue ? '#dc2626' : '#d97706'}; padding: 12px 16px; border-radius: 4px; margin-bottom: 16px;">
            <strong style="color: ${isOverdue ? '#dc2626' : '#d97706'};">${statusText}</strong>
          </div>
          <h2 style="color: #1e293b; margin: 0 0 8px;">Recordatorio para: ${leadName}</h2>
          <p style="color: #475569; font-size: 15px; margin: 0 0 16px;">${reminder.description}</p>
          <p style="color: #94a3b8; font-size: 13px;">
            Fecha programada: ${new Date(reminder.dueDate).toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short' })}
          </p>
          <a href="${leadUrl}" style="display: inline-block; margin-top: 16px; background: #4f46e5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            Ver lead en el CRM →
          </a>
        </div>
      `;

      const recipients: string[] = [];
      if (reminder.userEmail) {
        recipients.push(reminder.userEmail);
      } else {
        recipients.push(...adminEmails);
      }

      if (recipients.length === 0) {
        console.log(`⚠️ [Reminders] Sin destinatario para reminder #${reminder.id}`);
        continue;
      }

      try {
        await sgMail.default.send({
          to: recipients,
          from: fromEmail,
          subject,
          html: htmlBody,
        });
        console.log(`✅ [Reminders] Email enviado para reminder #${reminder.id} → ${recipients.join(', ')}`);
      } catch (emailErr: any) {
        console.error(`❌ [Reminders] Error enviando email para reminder #${reminder.id}:`, emailErr?.response?.body || emailErr.message);
      }

      await db
        .update(crmReminders)
        .set({ notifiedAt: now })
        .where(eq(crmReminders.id, reminder.id));
    }
  } catch (error) {
    console.error('❌ [Reminders] Error en job de notificaciones:', error instanceof Error ? error.message : String(error));
  }
}

export function startReminderNotifications() {
  console.log('🔔 Programando job de notificaciones de recordatorios (cada hora)...');

  cron.schedule('0 * * * *', sendReminderEmails);

  sendReminderEmails().catch(console.error);
}
