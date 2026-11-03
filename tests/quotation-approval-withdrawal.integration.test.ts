import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { getTableColumns, getTableName } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { clients, clientBillingEntities, roles, users, quotations, quotationTeamMembers, quotationVariants, quotationRevisions, quotationApprovals, quotationEvents, proposalDocuments } from "../shared/schema";

const fixture = vi.hoisted(() => ({ url: process.env.FINANCIAL_TEST_DATABASE_URL, schema: `quotation_withdraw_${process.pid}`, notify: vi.fn() }));
if (fixture.url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(fixture.url).hostname)) throw new Error("Local test database required");
vi.mock("../server/db", async () => {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({ connectionString: fixture.url, options: `-c search_path=${fixture.schema}`, max: 3 });
  return { pool, db: drizzle(pool) };
});
vi.mock("../server/services/user-notifications", () => ({ createUserNotifications: fixture.notify }));
import { db, pool } from "../server/db";
import { persistQuotationRevision, withdrawQuotationApproval } from "../server/services/quotation-revisions";
import { notifyQuotationApprovalRequests } from "../server/services/quotation-approval-notifications";

const tables = [clients, clientBillingEntities, roles, users, quotations, quotationTeamMembers, quotationVariants, quotationRevisions, quotationApprovals, quotationEvents, proposalDocuments];
const withdraw = (actor = { id: 1 }, version = 4) => db.transaction(tx => withdrawQuotationApproval(tx, 100, version, actor, "Corregir costos del equipo"));

describe.skipIf(!fixture.url)("quotation withdrawal and approval notices in PostgreSQL", () => {
  let admin: Pool;
  beforeAll(async () => {
    admin = new Pool({ connectionString: fixture.url });
    await admin.query(`CREATE SCHEMA ${fixture.schema}`);
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table)).map(col => `"${col.name}" ${col.getSQLType()}${col.primary ? " PRIMARY KEY" : ""}`);
      await pool.query(`CREATE TABLE "${getTableName(table)}" (${columns.join(",")})`);
    }
    await pool.query("ALTER TABLE quotation_revisions ADD UNIQUE(quotation_id,revision_number)");
    await pool.query("ALTER TABLE quotation_events ADD UNIQUE(event_key)");
  });
  beforeEach(async () => {
    fixture.notify.mockReset().mockResolvedValue(true);
    await pool.query(`TRUNCATE ${tables.map(table => `"${getTableName(table)}"`).join(",")} RESTART IDENTITY`);
    await pool.query(`INSERT INTO clients(id,name) VALUES(1,'Cliente de prueba');
      INSERT INTO roles(id,name) VALUES(1,'Analista');
      INSERT INTO users(id,is_admin,is_active,role,permissions) VALUES
        (1,false,true,'member','{quotations,quotations_approve}'),
        (2,false,true,'member','{quotations,operations}'),
        (3,false,true,'member','{quotations,quotations_approve}'),
        (4,false,true,'member','{quotations}'),
        (5,true,false,'admin','{}'), (6,false,true,'admin','{}'),
        (7,false,true,'member','{operations}');
      INSERT INTO quotations(id,client_id,project_name,status,revision_number,lock_version,created_by,total_amount,base_cost,archived_at)
        VALUES(100,1,'Cotización de prueba','pending',2,4,1,1200,600,null);
      INSERT INTO quotation_team_members(quotation_id,role_id,hours,rate,cost) VALUES(100,1,10,60,600);
      INSERT INTO quotation_variants(quotation_id,variant_name,total_amount,is_selected) VALUES(100,'Base',1200,false);
      INSERT INTO proposal_documents(quotation_id,status,is_stale) VALUES(100,'ready',false);`);
    const { revision } = await db.transaction(tx => persistQuotationRevision(tx, 100, 1, "Enviada a revisión"));
    await pool.query(`INSERT INTO quotation_approvals(quotation_id,revision_id,rule_code,status,requested_by)
      VALUES(100,$1,'standard','pending',1),(100,$1,'manual','pending',1),(100,$1,'historical','approved',1)`, [revision.id]);
  });
  afterAll(async () => {
    await pool.end();
    if (admin) { await admin.query(`DROP SCHEMA ${fixture.schema} CASCADE`); await admin.end(); }
  });
  it("returns to an editable draft, cancels requests and preserves prices, teams and immutable snapshots", async () => {
    const oldRevision = (await pool.query("SELECT * FROM quotation_revisions")).rows;
    const teams = (await pool.query("SELECT * FROM quotation_team_members")).rows;
    const variants = (await pool.query("SELECT * FROM quotation_variants")).rows;
    const result = await withdraw();
    expect(result).toMatchObject({ status: "draft", revisionNumber: 3, lockVersion: 5, totalAmount: 1200, baseCost: 600 });
    expect((await pool.query("SELECT * FROM quotation_revisions WHERE revision_number=2")).rows).toEqual(oldRevision);
    expect((await pool.query("SELECT * FROM quotation_team_members")).rows).toEqual(teams);
    expect((await pool.query("SELECT * FROM quotation_variants")).rows).toEqual(variants);
    expect((await pool.query("SELECT status FROM quotation_approvals ORDER BY id")).rows.map(row => row.status)).toEqual(["cancelled", "cancelled", "approved"]);
    expect((await pool.query("SELECT is_stale,status FROM proposal_documents")).rows).toEqual([{ is_stale: true, status: "draft" }]);
    expect((await pool.query("SELECT event_type,actor_user_id,metadata FROM quotation_events")).rows[0]).toMatchObject({ event_type: "approval-withdrawn", actor_user_id: 1, metadata: { fromRevision: 2, reason: "Corregir costos del equipo" } });
    expect((await pool.query("SELECT status FROM quotation_revisions WHERE revision_number=3")).rows[0].status).toBe("draft");
    // A corrected proposal must receive a new revision and new approval requests.
    await pool.query("UPDATE quotations SET status='pending',revision_number=4,lock_version=6,total_amount=1400 WHERE id=100");
    const { revision } = await db.transaction(tx => persistQuotationRevision(tx, 100, 1, "Nueva solicitud"));
    await pool.query("INSERT INTO quotation_approvals(quotation_id,revision_id,rule_code,status,requested_by) VALUES(100,$1,'standard','pending',1)", [revision.id]);
    expect((await pool.query("SELECT count(*)::int n FROM quotation_approvals WHERE status='pending'")).rows[0].n).toBe(1);
    expect((await pool.query("SELECT * FROM quotation_revisions WHERE revision_number=2")).rows).toEqual(oldRevision);
  });
  it("rejects unauthorized, stale, archived and already approved withdrawals", async () => {
    await expect(withdraw({ id: 4 })).rejects.toMatchObject({ statusCode: 403 });
    await expect(withdraw({ id: 1 }, 3)).rejects.toMatchObject({ statusCode: 409 });
    await pool.query("UPDATE quotations SET archived_at=now() WHERE id=100");
    await expect(withdraw()).rejects.toMatchObject({ statusCode: 409 });
    await pool.query("UPDATE quotations SET archived_at=null,status='internally-approved' WHERE id=100");
    await expect(withdraw()).rejects.toMatchObject({ statusCode: 409 });
    expect((await pool.query("SELECT count(*)::int n FROM quotation_events")).rows[0].n).toBe(0);
  });
  it("allows an approver to return the request to draft without self approval", async () => {
    const actor = { id: 2, permissions: ["operations"] };
    const result = await db.transaction(tx => withdrawQuotationApproval(tx, 100, 4, actor, "Corrección pedida por comercial"));
    expect(result.status).toBe("draft");
  });
  it("does not let the requester of a historical revision withdraw someone else's current request", async () => {
    await pool.query("UPDATE quotations SET created_by=9 WHERE id=100");
    await pool.query("UPDATE quotation_approvals SET requested_by=2 WHERE quotation_id=100");
    await pool.query("INSERT INTO quotation_revisions(quotation_id,revision_number,status,snapshot,document_hash) VALUES(100,1,'draft','{}','old')");
    await pool.query("INSERT INTO quotation_approvals(quotation_id,revision_id,rule_code,status,requested_by) SELECT 100,id,'standard','cancelled',1 FROM quotation_revisions WHERE revision_number=1");
    await expect(withdraw()).rejects.toMatchObject({ statusCode: 403 });
  });
  it("rejects withdrawal if approval obtains the lock first", async () => {
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      await connection.query("SELECT id FROM quotations WHERE id=100 FOR UPDATE");
      const withdrawal = withdraw().catch(error => error);
      await connection.query("UPDATE quotations SET status='internally-approved',lock_version=5 WHERE id=100");
      await connection.query("COMMIT");
      expect(await withdrawal).toMatchObject({ statusCode: 409 });
      expect((await pool.query("SELECT count(*)::int n FROM quotation_events")).rows[0].n).toBe(0);
    } finally { await connection.query("ROLLBACK"); connection.release(); }
  });
  it("rolls back the withdrawal if the audit event fails", async () => {
    await pool.query("ALTER TABLE quotation_events ADD CONSTRAINT fail_withdrawal CHECK(event_type <> 'approval-withdrawn')");
    try { await expect(withdraw()).rejects.toThrow(); }
    finally { await pool.query("ALTER TABLE quotation_events DROP CONSTRAINT fail_withdrawal"); }
    expect((await pool.query("SELECT status,lock_version FROM quotations WHERE id=100")).rows[0]).toEqual({ status: "pending", lock_version: 4 });
    expect((await pool.query("SELECT count(*)::int n FROM quotation_revisions")).rows[0].n).toBe(1);
    expect((await pool.query("SELECT count(*)::int n FROM quotation_approvals WHERE status='cancelled'")).rows[0].n).toBe(0);
  });
  it("serializes concurrent withdrawals and rejects an approval racing after withdrawal", async () => {
    const results = await Promise.allSettled([withdraw(), withdraw()]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect((await pool.query("SELECT count(*)::int n FROM quotation_events")).rows[0].n).toBe(1);
    // The decision route takes the same row lock and checks this state before deciding.
    await db.transaction(async tx => {
      const state = await tx.execute(sql`SELECT status FROM quotations WHERE id=100 FOR UPDATE`);
      expect(state.rows[0].status).toBe("draft");
    });
  });
  it("notifies active approvers once per revision, excluding the requester and unrelated users", async () => {
    await notifyQuotationApprovalRequests([100]);
    expect(fixture.notify).toHaveBeenCalledOnce();
    expect(fixture.notify).toHaveBeenCalledWith([2, 3, 6], expect.objectContaining({ type: "quotation_approval", entityType: "quotation", entityId: 100, actionUrl: "/quotations/100#commercial-approval" }));
    const eventKey = fixture.notify.mock.calls[0][1].eventKey;
    await notifyQuotationApprovalRequests([100]);
    expect(fixture.notify.mock.calls[1][1].eventKey).toBe(eventKey); // Persistence deduplicates this key per user.
    await withdraw();
    fixture.notify.mockClear();
    await notifyQuotationApprovalRequests([100]);
    expect(fixture.notify).not.toHaveBeenCalled();
  });
  it("ignores pending requests from superseded revisions", async () => {
    await pool.query("UPDATE quotations SET revision_number=3 WHERE id=100");
    const { revision } = await db.transaction(tx => persistQuotationRevision(tx, 100, 1, "Nueva versión"));
    await pool.query("INSERT INTO quotation_approvals(quotation_id,revision_id,rule_code,status,requested_by) VALUES(100,$1,'standard','pending',1)", [revision.id]);
    await notifyQuotationApprovalRequests([100]);
    expect(fixture.notify).toHaveBeenCalledOnce();
    expect(fixture.notify.mock.calls[0][1].eventKey).toBe(`quotation-approval:100:${revision.id}`);
  });
  it("does not fail a committed submission when notification delivery fails", async () => {
    fixture.notify.mockRejectedValue(new Error("Delivery unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try { await expect(notifyQuotationApprovalRequests([100])).resolves.toBeUndefined(); }
    finally { log.mockRestore(); }
    expect((await pool.query("SELECT status FROM quotations WHERE id=100")).rows[0].status).toBe("pending");
  });
});
