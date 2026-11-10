import express from "express";
import session from "express-session";
import { createServer, type Server } from "node:http";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { Pool } from "pg";
import { registerNotificationRoutes } from "../server/routes-notifications";
import { setupAuth, hashPassword } from "../server/auth";
import type { IStorage } from "../server/storage";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { SQL, sql } from "drizzle-orm";
import { createHmac,
  createHash, generateKeyPairSync, sign } from "node:crypto";
import * as schema from "../shared/schema";
import { notificationReliabilityMigrationSql } from "../server/migrations/notification-reliability";
const fixture = vi.hoisted(() => ({
  url: process.env.NOTIFICATION_TEST_DATABASE_URL,
  schema: `notification_test_${process.pid}`,
}));
if (
  fixture.url &&
  !["localhost", "127.0.0.1", "[::1]"].includes(new URL(fixture.url).hostname)
)
  throw Error("A local database is required");
vi.mock("../server/db", async () => {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({
    connectionString: fixture.url,
    options: `-c search_path=${fixture.schema}`,
    max: 4,
  });
  return { pool, db: drizzle(pool) };
});
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async () => ({ statusCode: 201 })),
  },
}));
import webpush from "web-push";
import { db, pool } from "../server/db";
import {
  createUserNotifications,
  dispatchUserNotificationEmails,
  dispatchUserNotificationPushes,
  retryUserNotificationEmailDelivery,
} from "../server/services/user-notifications";
import { notificationAccess } from "../server/services/notification-access";
import {
  verifyNotificationWebhook,
  recordNotificationEmailEvent,
  verifySendgridWebhook,
  recordSendgridEvents,
} from "../server/services/notification-email-events";
import { saveNotificationPreferences } from "../server/services/notification-preferences";
import { sendTransactionalEmail } from "../server/services/email-transport";
import { notifyMcpStatusNote } from "../server/services/mcp-status-notifications";
const tables = [
  schema.users,
  schema.personnel,
  schema.activeProjects,
  schema.tasks,
  schema.taskProjectMembers,
  schema.reviewRooms,
  schema.reviewRoomMembers,
  schema.projectReviewNotes,
  schema.quotations,
  schema.quotationApprovals,
  schema.quotationRevisions,
  schema.crmLeads,
  schema.personnelAbsences,
  schema.monthlySettlementDeclarations,
  schema.personnelMonthlySettlements,
  schema.userNotifications,
  schema.userNotificationPreferences,
  schema.userNotificationPushSubscriptions,
  schema.userNotificationEmailDeliveries,
];
const input = {
  eventKey: "reply:1",
  type: "mind_reply",
  title: "Proyecto privado",
  message: "Información del proyecto",
  entityType: "review_room",
  entityId: 1,
  threadKey: "mind:1:p_1",
  actionUrl: "/review/1?item=p_1&noteId=1",
};
const query = (text: string, values?: unknown[]) => pool.query(text, values);
const statuses = async () =>
  (
    await query(
      "SELECT status FROM user_notification_email_deliveries ORDER BY id",
    )
  ).rows.map((r) => r.status);
let admin: Pool;
let server: Server;
let baseUrl: string;
const httpFetch = globalThis.fetch;
const http = (
  path: string,
  userId = 1,
  body?: unknown,
  method = body ? "POST" : "GET",
  cookie?: string,
) =>
  httpFetch(baseUrl + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-test-user": String(userId) } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
describe.skipIf(!fixture.url)(
  "notification system with PostgreSQL and fake providers",
  () => {
    beforeAll(async () => {
      admin = new Pool({ connectionString: fixture.url });
      await admin.query(`CREATE SCHEMA ${fixture.schema}`);
      const dialect = new PgDialect();
      for (const table of tables) {
        const config = getTableConfig(table);
        const columns = config.columns.map((c) => {
          const d = c.default;
          const def =
            d instanceof SQL
              ? dialect.sqlToQuery(d).sql
              : d === undefined
                ? undefined
                : typeof d === "number" || typeof d === "boolean"
                  ? String(d)
                  : `'${(Array.isArray(d) && c.getSQLType().endsWith("[]") ? "{" + d.join(",") + "}" : typeof d === "object" ? JSON.stringify(d) : String(d)).replaceAll("'", "''")}'`;
          return `"${c.name}" ${c.getSQLType()}${c.primary ? " PRIMARY KEY" : ""}${def ? " DEFAULT " + def : ""}`;
        });
        await query(`CREATE TABLE "${config.name}" (${columns.join(",")})`);
      }
      await query(
        "ALTER TABLE user_notifications ADD UNIQUE(user_id,event_key); ALTER TABLE user_notification_push_subscriptions ADD UNIQUE(endpoint); ALTER TABLE user_notification_email_deliveries ADD UNIQUE(notification_id)",
      );
      await query(notificationReliabilityMigrationSql);
      await query(notificationReliabilityMigrationSql);
      const password = await hashPassword("test-password");
      const storage = {
        sessionStore: new session.MemoryStore(),
        getUser: async (id: number) =>
          (
            await db
              .select()
              .from(schema.users)
              .where(sql`id=${id}`)
          )[0],
        getUserByEmail: async (email: string) => {
          const [row] = await db
            .select()
            .from(schema.users)
            .where(sql`email=${email}`);
          return row ? { ...row, password } : undefined;
        },
        getPersonnel: async () => [],
      };
      const app = express();
      app.use(express.json());
      const { requireAuth } = setupAuth(app, storage as unknown as IStorage);
      registerNotificationRoutes(app, (req, res, next) => {
        if (req.get("x-test-user"))
          req.session.userId = Number(req.get("x-test-user"));
        return requireAuth(req, res, next);
      });
      app.use(
        (
          _err: unknown,
          _req: express.Request,
          res: express.Response,
          _next: express.NextFunction,
        ) => {
          res.status(500).json({ error: "internal" });
        },
      );
      server = createServer(app);
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    });
    beforeEach(async () => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
      vi.clearAllMocks();
      vi.stubEnv("RESEND_API_KEY", "test-key");
      vi.stubEnv("RESEND_FROM_EMAIL", "Mind <test@example.test>");
      vi.stubEnv("APP_URL", "https://mind.example.test");
      vi.stubEnv("VAPID_PUBLIC_KEY", "test-public");
      vi.stubEnv("VAPID_PRIVATE_KEY", "test-private");
      await query(
        `TRUNCATE ${tables.map((t) => getTableConfig(t).name).join(",")},user_notification_push_deliveries,user_notification_thread_mutes,notification_email_batches,notification_email_events,notification_email_suppressions,transactional_email_deliveries RESTART IDENTITY CASCADE`,
      );
      await query(`INSERT INTO users(id,email,is_active,permissions,role,is_admin) VALUES
   (1,'one@example.test',true,'{status,projects}','member',false),(2,'two@example.test',true,'{status,projects}','member',false),
   (3,'crm@example.test',true,'{crm}','member',false),(4,'ops@example.test',true,'{operations}','member',false),
   (5,'admin@example.test',true,'{}','admin',false),(6,'inactive@example.test',false,'{status,projects}','member',false),
   (7,'limited@example.test',true,'{task_manager}','member',false);
   INSERT INTO personnel(id,email,name) VALUES(1,'one@example.test','Uno'),(2,'two@example.test','Dos'),(7,'limited@example.test','Limitado');
   INSERT INTO review_rooms(id,name) VALUES(1,'Privado'); INSERT INTO review_room_members(room_id,user_id,role) VALUES(1,1,'owner'),(1,2,'editor'),(1,6,'editor');
   INSERT INTO active_projects(id,name,status) VALUES(1,'Proyecto','active'); INSERT INTO tasks(id,project_id,title) VALUES(1,1,'Tarea');
   INSERT INTO task_project_members(project_id,personnel_id) VALUES(1,1),(1,7);
   INSERT INTO crm_leads(id,company_name) VALUES(1,'Lead');
   INSERT INTO user_notification_preferences(user_id,email_enabled,desktop_enabled,settings) SELECT id,true,true,'{"activityEmailMode":"immediate","digestHour":9,"timeZone":"UTC","quietHours":{"enabled":false,"start":20,"end":9}}' FROM users;
   INSERT INTO user_notification_push_subscriptions(user_id,endpoint,p256dh,auth,device_token) VALUES(1,'https://push.example.test/one','test-key','test-auth','device-one'),(2,'https://push.example.test/two','test-key','test-auth','device-two')`);
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(JSON.stringify({ id: "provider-1" }), { status: 200 }),
        ),
      );
    });
    afterAll(async () => {
      if (server)
        await new Promise<void>((resolve, reject) =>
          server.close((err) => (err ? reject(err) : resolve())),
        );
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
      await pool.end();
      if (admin) {
        await admin.query(`DROP SCHEMA ${fixture.schema} CASCADE`);
        await admin.end();
      }
    });
    it("queues MCP note notifications on the same transaction, respecting thread, author and access", async () => {
      await query(`INSERT INTO project_review_notes(room_id,project_id,content,author_id) VALUES
        (1,1,'Anterior',2),(1,1,'Inactivo',6),(1,1,'Sin permiso',3),(2,1,'Otra sala',5)`);
      const client = await pool.connect();
      try {
        for (const commit of [false, true]) {
          await client.query("BEGIN");
          const { rows } = await client.query("INSERT INTO project_review_notes(room_id,project_id,content,author_id) VALUES(1,1,'Confirmada',1) RETURNING id");
          const event = { id: rows[0].id, roomId: 1, kind: "project" as const, itemId: 1, userId: 1, title: "Proyecto" };
          await notifyMcpStatusNote(client, event);
          await notifyMcpStatusNote(client, event);
          await client.query(commit ? "COMMIT" : "ROLLBACK");
          expect((await query("SELECT user_id FROM user_notifications")).rows.map(r => r.user_id)).toEqual(commit ? [2] : []);
          expect((await query("SELECT * FROM user_notification_email_deliveries")).rowCount).toBe(commit ? 1 : 0);
        }
      } finally { client.release(); }
    });
    it("filters candidates by module, active account and actual membership, even for administrators", async () => {
      await createUserNotifications([1, 2, 3, 4, 5, 6, 7], input);
      expect(
        (
          await query("SELECT user_id FROM user_notifications ORDER BY user_id")
        ).rows.map((r) => r.user_id),
      ).toEqual([1, 2]);
      await createUserNotifications([1, 2, 3, 4, 5, 6, 7], {
        ...input,
        eventKey: "task:1",
        type: "task_assigned",
        entityType: "task",
      });
      expect(
        (
          await query(
            "SELECT user_id FROM user_notifications WHERE event_key='task:1' ORDER BY user_id",
          )
        ).rows.map((r) => r.user_id),
      ).toEqual([1, 4, 5, 7]);
      await createUserNotifications([1, 2, 3, 4, 5, 6, 7], {
        ...input,
        eventKey: "crm:1",
        type: "crm_reminder",
        entityType: "crm_lead",
      });
      expect(
        (
          await query(
            "SELECT user_id FROM user_notifications WHERE event_key='crm:1' ORDER BY user_id",
          )
        ).rows.map((r) => r.user_id),
      ).toEqual([3, 5]);
    });
    it("restricts approval, absence and settlement audiences to the required capability and owner", async () => {
      await query(`UPDATE users SET permissions='{quotations,quotations_approve}' WHERE id=2;
    INSERT INTO quotations(id,status,revision_number) VALUES(1,'pending',1);
    INSERT INTO quotation_revisions(id,quotation_id,revision_number) VALUES(1,1,1);
    INSERT INTO quotation_approvals(quotation_id,revision_id,status,requested_by) VALUES(1,1,'pending',1);
    INSERT INTO personnel_absences(id,personnel_id,status) VALUES(1,1,'pending');
    INSERT INTO personnel_monthly_settlements(id,personnel_id,status) VALUES(1,1,'published')`);
      const recipients = async (key: string) =>
        (
          await query(
            "SELECT user_id FROM user_notifications WHERE event_key=$1 ORDER BY user_id",
            [key],
          )
        ).rows.map((r) => r.user_id);
      await createUserNotifications([1, 2, 3, 4, 5, 6, 7], {
        ...input,
        type: "quotation_approval",
        eventKey: "approval",
        actionUrl: "/quotations/1#commercial-approval",
      });
      expect(await recipients("approval")).toEqual([2, 5]);
      await createUserNotifications([1, 2, 3, 4, 5, 6, 7], {
        ...input,
        type: "absence_decision",
        eventKey: "absence-person",
        actionUrl: "/absences",
      });
      expect(await recipients("absence-person")).toEqual([1]);
      await createUserNotifications([1, 2, 3, 4, 5, 6, 7], {
        ...input,
        type: "absence_request",
        eventKey: "absence-ops",
        actionUrl: "/operations/absences",
      });
      expect(await recipients("absence-ops")).toEqual([4, 5]);
      await createUserNotifications([1, 2, 3, 4, 5, 6, 7], {
        ...input,
        type: "monthly_settlement",
        eventKey: "team-settlement:1:person",
        actionUrl: "/my-invoices",
      });
      expect(await recipients("team-settlement:1:person")).toEqual([1]);
    });
    it("rechecks module permissions and project membership before every channel", async () => {
      await createUserNotifications([1], {
        ...input,
        type: "task_reply",
        eventKey: "task-reply",
      });
      await query("DELETE FROM task_project_members WHERE personnel_id=1");
      await dispatchUserNotificationEmails();
      await dispatchUserNotificationPushes();
      expect(fetch).not.toHaveBeenCalled();
      expect(webpush.sendNotification).not.toHaveBeenCalled();
      await createUserNotifications([1], {
        ...input,
        eventKey: "mind-after-task",
      });
      await query("UPDATE users SET permissions='{}' WHERE id=1");
      await dispatchUserNotificationEmails();
      await dispatchUserNotificationPushes();
      expect(fetch).not.toHaveBeenCalled();
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });
    it("merges simultaneous preference patches and lets users finish setup with no external channel", async () => {
      await Promise.all([
        saveNotificationPreferences(1, {
          categoryPreferences: { mind: { email: false } },
        }),
        saveNotificationPreferences(1, {
          categoryPreferences: { mind: { desktop: false } },
        }),
        saveNotificationPreferences(1, { discreetMode: false }),
      ]);
      const row = (
        await query(
          "SELECT * FROM user_notification_preferences WHERE user_id=1",
        )
      ).rows[0];
      expect(row.category_preferences.mind).toEqual({
        email: false,
        desktop: false,
      });
      expect(row.discreet_mode).toBe(false);
      const saved = await saveNotificationPreferences(1, {
        setupCompleted: true,
        emailEnabled: false,
        desktopEnabled: false,
      });
      expect(saved.setupCompletedAt).toBeInstanceOf(Date);
    });
    it("uses current access for the inbox and cancels queued email and push after removal", async () => {
      await createUserNotifications([1, 2], input);
      await query("DELETE FROM review_room_members WHERE user_id=2");
      const inbox = await db
        .select()
        .from(schema.userNotifications)
        .where(notificationAccess(schema.userNotifications.userId));
      expect(inbox.map((n) => n.userId)).toEqual([1]);
      await dispatchUserNotificationEmails();
      await dispatchUserNotificationPushes();
      expect(await statuses()).toEqual(["sent", "cancelled"]);
      expect(vi.mocked(webpush.sendNotification)).toHaveBeenCalledTimes(1);
    });
    it("saves the business mutation and both delivery channels atomically and deduplicates retries", async () => {
      await expect(
        db.transaction(async (tx) => {
          await tx.execute(sql`UPDATE tasks SET title='changed' WHERE id=1`);
          await createUserNotifications([1], input, tx);
          throw Error("rollback");
        }),
      ).rejects.toThrow("rollback");
      expect(
        (await query("SELECT title FROM tasks WHERE id=1")).rows[0].title,
      ).toBe("Tarea");
      expect(await statuses()).toEqual([]);
      await createUserNotifications([1, 1], input);
      await createUserNotifications([1], input);
      expect(
        (await query("SELECT count(*)::int c FROM user_notifications")).rows[0]
          .c,
      ).toBe(1);
      expect(
        (
          await query(
            "SELECT count(*)::int c FROM user_notification_push_deliveries",
          )
        ).rows[0].c,
      ).toBe(1);
    });
    it("delivers a single digest, excludes read items, and persists a retry without duplicating sends", async () => {
      await query(
        `UPDATE user_notification_preferences SET settings=jsonb_set(settings,'{activityEmailMode}','"daily"')`,
      );
      await createUserNotifications([1], input);
      await createUserNotifications([1], { ...input, eventKey: "reply:2" });
      await createUserNotifications([1], { ...input, eventKey: "reply:3" });
      await query(
        "UPDATE user_notifications SET read_at=NOW() WHERE event_key='reply:3';UPDATE user_notification_email_deliveries SET next_attempt_at=NOW()",
      );
      await dispatchUserNotificationEmails();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(await statuses()).toEqual(["sent", "sent", "cancelled"]);
      const body = JSON.parse(
        vi.mocked(fetch).mock.calls[0][1]!.body as string,
      );
      expect(body.subject).toContain("2 novedades");
      expect(body.html).not.toContain("Proyecto privado");
      await dispatchUserNotificationEmails();
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    it("retries transient email and push failures and recovers stale processing work", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response("{}", { status: 503 }),
      );
      vi.mocked(webpush.sendNotification).mockRejectedValueOnce({
        statusCode: 503,
      });
      await createUserNotifications([1], input);
      await dispatchUserNotificationEmails();
      await dispatchUserNotificationPushes();
      expect(await statuses()).toEqual(["pending"]);
      await query(
        "UPDATE user_notification_email_deliveries SET next_attempt_at=NOW(); UPDATE user_notification_push_deliveries SET status='processing',locked_at=NOW()-INTERVAL '10 minutes'",
      );
      await dispatchUserNotificationEmails();
      await dispatchUserNotificationPushes();
      expect(await statuses()).toEqual(["sent"]);
      expect(vi.mocked(webpush.sendNotification)).toHaveBeenCalledTimes(2);
    });
    it("recovers processing deliveries left by the previous worker without a batch row", async () => {
      await createUserNotifications([1], input);
      await query("DELETE FROM notification_email_batches; UPDATE user_notification_email_deliveries SET batch_key=NULL,status='processing',locked_at=NOW()-INTERVAL '10 minutes'");
      await dispatchUserNotificationEmails();
      expect(await statuses()).toEqual(["sent"]);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect((vi.mocked(fetch).mock.calls[0][1]!.headers as Record<string,string>)["Idempotency-Key"]).toBe(createHash("sha256").update(`${input.eventKey}:1`).digest("hex"));
    });
    it("recovers stale mail leases and stops retrying ambiguous deliveries outside the provider window", async () => {
      await createUserNotifications([1], input);
      await query(
        "UPDATE notification_email_batches SET status='processing',updated_at=NOW()-INTERVAL '10 minutes';UPDATE user_notification_email_deliveries SET status='processing',locked_at=NOW()-INTERVAL '10 minutes'",
      );
      await dispatchUserNotificationEmails();
      expect(await statuses()).toEqual(["sent"]);
      const email = {
        to: "client@example.test",
        subject: "Propuesta",
        text: "Propuesta",
        html: "<p>Propuesta</p>",
      };
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network timeout"));
      await expect(
        sendTransactionalEmail(email, "ambiguous:1"),
      ).rejects.toThrow("Network timeout");
      await query(
        "UPDATE transactional_email_deliveries SET created_at=NOW()-INTERVAL '25 hours' WHERE recipient='client@example.test'",
      );
      const calls = vi.mocked(fetch).mock.calls.length;
      await expect(
        sendTransactionalEmail(email, "ambiguous:1"),
      ).rejects.toThrow("plazo seguro");
      expect(fetch).toHaveBeenCalledTimes(calls);
    });
    it("exhausts transient retries and allows an administrator to retry a definite failure", async () => {
      await createUserNotifications([1], input);
      await query("UPDATE user_notification_email_deliveries SET attempts=6");
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response("{}", { status: 503 }),
      );
      await dispatchUserNotificationEmails();
      expect(await statuses()).toEqual(["failed"]);
      const id = (
        await query("SELECT id FROM user_notification_email_deliveries")
      ).rows[0].id;
      expect(await retryUserNotificationEmailDelivery(id)).toBe(true);
      await dispatchUserNotificationEmails();
      expect(await statuses()).toEqual(["sent"]);
      expect(await retryUserNotificationEmailDelivery(id)).toBe(false);
    });
    it("cancels reassigned devices and respects muted threads at dispatch", async () => {
      await createUserNotifications([1], input);
      await query(
        "UPDATE user_notification_push_subscriptions SET user_id=2 WHERE user_id=1;INSERT INTO user_notification_thread_mutes VALUES(1,'mind:1:p_1')",
      );
      await dispatchUserNotificationPushes();
      await dispatchUserNotificationEmails();
      expect(webpush.sendNotification).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      expect(await statuses()).toEqual(["cancelled"]);
    });
    it("tracks signed delivery events once, keeps terminal states, and suppresses repeated bounces", async () => {
      await createUserNotifications([1], input);
      await dispatchUserNotificationEmails();
      const secret =
        "whsec_" + Buffer.from("test-signing-secret").toString("base64");
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = Buffer.from(
        JSON.stringify({
          type: "email.bounced",
          created_at: new Date().toISOString(),
          data: { email_id: "provider-1" },
        }),
      );
      const signature =
        "v1," +
        createHmac("sha256", Buffer.from("test-signing-secret"))
          .update(`evt-1.${timestamp}.`)
          .update(body)
          .digest("base64");
      const event = verifyNotificationWebhook(
        body,
        { id: "evt-1", timestamp, signature },
        secret,
      );
      await recordNotificationEmailEvent("evt-1", event);
      await recordNotificationEmailEvent("evt-1", event);
      await recordNotificationEmailEvent("evt-2", {
        ...event,
        type: "email.delivered",
      });
      expect(
        (
          await query(
            "SELECT delivery_status FROM user_notification_email_deliveries",
          )
        ).rows[0].delivery_status,
      ).toBe("bounced");
      expect(
        (await query("SELECT count(*)::int c FROM notification_email_events"))
          .rows[0].c,
      ).toBe(2);
      await createUserNotifications([1], { ...input, eventKey: "reply:2" });
      await dispatchUserNotificationEmails();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(() =>
        verifyNotificationWebhook(
          Buffer.from("tampered"),
          { id: "evt-1", timestamp, signature },
          secret,
        ),
      ).toThrow();
      expect(() =>
        verifyNotificationWebhook(
          body,
          { id: "evt-1", timestamp: "1", signature },
          secret,
        ),
      ).toThrow();
    });
    it("verifies SendGrid delivery signatures and reconciles events received before the send response", async () => {
      const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = Buffer.from(
        JSON.stringify([
          {
            event: "delivered",
            sg_event_id: "sg-event",
            sg_message_id: "sg-message.filter-123",
            timestamp: Number(timestamp),
          },
        ]),
      );
      const signature = sign(
        "sha256",
        Buffer.concat([Buffer.from(timestamp), body]),
        keys.privateKey,
      ).toString("base64");
      const publicKey = keys.publicKey
        .export({ format: "der", type: "spki" })
        .toString("base64");
      const events = verifySendgridWebhook(
        body,
        { timestamp, signature },
        publicKey,
      );
      await recordSendgridEvents(events);
      await query(
        "INSERT INTO transactional_email_deliveries(idempotency_key,payload_hash,provider,provider_id,recipient,status) VALUES('sg-test','hash','sendgrid','sg-message','client@example.test','accepted')",
      );
      const { reconcileNotificationEmailEvents } = await import(
        "../server/services/notification-email-events"
      );
      await reconcileNotificationEmailEvents(
        "sg-message",
        undefined,
        "sendgrid",
      );
      expect(
        (
          await query(
            "SELECT delivery_status FROM transactional_email_deliveries WHERE provider='sendgrid'",
          )
        ).rows[0].delivery_status,
      ).toBe("delivered");
      expect(() =>
        verifySendgridWebhook(
          Buffer.from("tampered"),
          { timestamp, signature },
          publicKey,
        ),
      ).toThrow();
    });
    it("does not revive pending messages after a channel or thread is paused and resumed", async () => {
      await createUserNotifications([1], input);
      await saveNotificationPreferences(1, {
        categoryPreferences: { mind: { email: false, desktop: false } },
      });
      await saveNotificationPreferences(1, {
        categoryPreferences: { mind: { email: true, desktop: true } },
      });
      await dispatchUserNotificationEmails();
      await dispatchUserNotificationPushes();
      expect(fetch).not.toHaveBeenCalled();
      expect(webpush.sendNotification).not.toHaveBeenCalled();
      await createUserNotifications([1], {
        ...input,
        eventKey: "reply:second",
      });
      const id = (
        await query(
          "SELECT id FROM user_notifications WHERE event_key='reply:second'",
        )
      ).rows[0].id;
      expect(
        (await http(`/api/notifications/${id}/mute`, 1, { muted: true }))
          .status,
      ).toBe(200);
      await http(`/api/notifications/${id}/mute`, 1, { muted: false });
      await dispatchUserNotificationEmails();
      await dispatchUserNotificationPushes();
      expect(fetch).not.toHaveBeenCalled();
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });
    it("enforces ownership in HTTP inbox, mutes, bulk read and admin endpoints", async () => {
      await createUserNotifications([1, 2], input);
      await query("DELETE FROM review_room_members WHERE user_id=2");
      const inbox = await (await http("/api/notifications", 2)).json();
      expect(inbox.items).toEqual([]);
      expect(inbox.unreadCount).toBe(0);
      const one = (
        await query("SELECT id FROM user_notifications WHERE user_id=1")
      ).rows[0].id;
      expect(
        (await http(`/api/notifications/${one}/mute`, 2, { muted: true }))
          .status,
      ).toBe(404);
      expect(
        (await http("/api/admin/notification-email-deliveries", 1)).status,
      ).toBe(403);
      expect(
        (await http("/api/admin/notification-email-deliveries", 5)).status,
      ).toBe(200);
      const read = await (
        await http("/api/notifications/read-many", 2, { ids: [one] }, "PATCH")
      ).json();
      expect(read.updated).toBe(0);
      expect(
        (await http("/api/notifications/invalid/read", 1, {}, "PATCH")).status,
      ).toBe(400);
      const prefs = await (
        await http("/api/notifications/preferences", 3)
      ).json();
      expect(prefs.availableCategories).toEqual(["crm"]);
      expect(
        (
          await http(
            "/api/notifications/preferences",
            1,
            {
              setupCompleted: true,
              emailEnabled: false,
              desktopEnabled: false,
            },
            "PUT",
          )
        ).status,
      ).toBe(200);
    });
    it("binds device cookies, rejects arbitrary endpoints and revokes only the logging-out browser", async () => {
      const subscribe = await http("/api/notifications/push/subscribe", 1, {
        endpoint: "https://fcm.googleapis.com/fcm/send/test",
        keys: { p256dh: "a".repeat(40), auth: "b".repeat(24) },
      });
      expect(subscribe.status).toBe(200);
      const cookie = subscribe.headers
        .getSetCookie()
        .find((c) => c.startsWith("mind_push_device="))!
        .split(";")[0];
      expect(cookie).toMatch(/mind_push_device=[a-f0-9]{64}$/);
      const devices = await (
        await http(
          "/api/notifications/push/devices",
          1,
          undefined,
          "GET",
          cookie,
        )
      ).json();
      expect(
        devices.filter((d: { current: boolean }) => d.current),
      ).toHaveLength(1);
      expect(
        (
          await http("/api/notifications/push/subscribe", 1, {
            endpoint: "https://127.0.0.1/private",
            keys: { p256dh: "a".repeat(40), auth: "b".repeat(24) },
          })
        ).status,
      ).toBe(400);
      const login = await http("/api/login", 0, {
        email: "one@example.test",
        password: "test-password",
      });
      const sid = login.headers
        .getSetCookie()
        .find((c) => c.startsWith("epical_sid="))!
        .split(";")[0];
      expect(
        (await http("/api/logout", 0, {}, "POST", sid + "; " + cookie)).status,
      ).toBe(200);
      expect(
        (
          await query(
            "SELECT endpoint FROM user_notification_push_subscriptions WHERE user_id=1",
          )
        ).rows.map((r) => r.endpoint),
      ).toEqual(["https://push.example.test/one"]);
    });
    it("revokes the old account's device when another account logs in with an expired session", async () => {
      const token = "a".repeat(64);
      await query(
        "UPDATE user_notification_push_subscriptions SET device_token=$1 WHERE user_id=1",
        [token],
      );
      const login = await http(
        "/api/login",
        0,
        { email: "two@example.test", password: "test-password" },
        "POST",
        `mind_push_device=${token}`,
      );
      expect(login.status).toBe(200);
      expect(
        (
          await query(
            "SELECT user_id FROM user_notification_push_subscriptions WHERE device_token=$1",
            [token],
          )
        ).rows,
      ).toEqual([]);
    });
    it("reuses accepted commercial email requests and rejects payload changes", async () => {
      const email = {
        to: "client@example.test",
        subject: "Propuesta",
        text: "Propuesta",
        html: "<p>Propuesta</p>",
      };
      await sendTransactionalEmail(email, "commercial:1");
      await sendTransactionalEmail(email, "commercial:1");
      expect(fetch).toHaveBeenCalledTimes(1);
      await expect(
        sendTransactionalEmail({ ...email, subject: "Cambio" }, "commercial:1"),
      ).rejects.toThrow("contenido");
    });
  },
);
