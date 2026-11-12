import { visibleRows, canSeeQuotations } from "./access";
import { Router, type Express, type RequestHandler } from "express";
import { pool } from "../db";
import { requirePermission } from "../middleware/requirePermission";
import { z } from "zod";
import {
  opportunitySchema,
  validateOpportunity,
  summarize,
  alerts,
  executiveSummary,
  periodSchema,
  localDay,
  type Opportunity,
} from "../../shared/pipeline";
import type { PoolClient } from "pg";
const version = z.number().int().positive();
const reason = z.string().trim().min(1).max(4000);
const key = z.string().uuid();
const filters = z.object({
  snapshotId: z.coerce.number().int().positive().optional(),
  q: z.string().max(200).optional(),
  account: z.string().optional(),
  stage: z.string().optional(),
  owner: z.string().optional(),
  scope: z.string().optional(),
  alert: z.string().optional(),
  closeMonth: z.union([periodSchema, z.literal("pending")]).optional(),
  group: z.enum(["stage", "account", "owner", "closeMonth"]).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export async function transaction<T>(fn: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function audit(
  c: PoolClient,
  actor: number,
  kind: string,
  why: string,
  changes: unknown,
  opportunityId: number | null = null,
  period: string | null = null,
) {
  await c.query(
    "INSERT INTO pipeline_log(actor_id,kind,reason,changes,opportunity_id,period) VALUES($1,$2,$3,$4,$5,$6)",
    [actor, kind, why, JSON.stringify(changes), opportunityId, period],
  );
}
export async function currentRows(
  c: Pick<PoolClient, "query"> = pool,
): Promise<Opportunity[]> {
  const { rows } =
    await c.query(`SELECT p.*,COALESCE(st.label,l.stage) AS native_stage,l.company_name,l.client_id AS lead_client_id,l.assigned_to,
 concat_ws(' ',u.first_name,u.last_name) AS resolved_owner,contact.name AS resolved_contact
 FROM pipeline_opportunities p LEFT JOIN crm_leads l ON l.id=p.lead_id
 LEFT JOIN crm_stages st ON st.key=l.stage
 LEFT JOIN users u ON u.id=COALESCE(p.owner_id,l.assigned_to)
 LEFT JOIN LATERAL (SELECT name FROM crm_contacts WHERE (id=p.contact_id OR (p.contact_id IS NULL AND lead_id=p.lead_id AND is_primary=true)) ORDER BY id LIMIT 1) contact ON true
 ORDER BY p.evidence_date DESC NULLS LAST,p.id`);
  return rows.map((r) => ({
    ...r.data,
    id: r.id,
    version: r.version,
    importKey: r.import_key,
    nativeStage: r.native_stage,
    usd: r.usd,
    probability: r.probability,
    account: r.company_name ?? r.data.account,
    clientId: r.client_id ?? r.lead_client_id ?? null,
    ownerId: r.owner_id ?? r.assigned_to ?? null,
    owner: r.resolved_owner || r.data.owner,
    contact: r.resolved_contact ?? r.data.contact,
  }));
}
export async function writeOpportunity(
  c: PoolClient,
  r: Opportunity,
  importKey: string | null = null,
  id?: number,
  expected?: number,
) {
  for (const [table, value] of [
    ["crm_leads", r.leadId],
    ["clients", r.clientId],
    ["users", r.ownerId],
    ["quotations", r.quotationId],
    ["quotation_groups", r.quotationGroupId],
  ] as const) {
    if (
      value &&
      !(await c.query(`SELECT id FROM ${table} WHERE id=$1`, [value])).rowCount
    )
      throw new Error(`Vínculo inexistente: ${table}`);
  }
  if (
    r.contactId &&
    !(
      await c.query("SELECT id FROM crm_contacts WHERE id=$1 AND lead_id=$2", [
        r.contactId,
        r.leadId,
      ])
    ).rowCount
  )
    throw new Error("El contacto no pertenece al lead");
  const values = [
    r.leadId,
    r.clientId,
    r.ownerId,
    r.contactId,
    r.quotationId,
    r.quotationGroupId,
    r.usd,
    r.probability,
    r.closeDate,
    r.evidenceDate,
    JSON.stringify(r),
  ];
  if (id) {
    const result = await c.query(
      "UPDATE pipeline_opportunities SET lead_id=$1,client_id=$2,owner_id=$3,contact_id=$4,quotation_id=$5,quotation_group_id=$6,usd=$7,probability=$8,close_date=$9,evidence_date=$10,data=$11,version=version+1,updated_at=now() WHERE id=$12 AND version=$13 RETURNING id,version",
      [...values, id, expected],
    );
    if (!result.rowCount)
      throw Object.assign(
        new Error("Otro usuario modificó la ficha. Recargá antes de guardar."),
        { status: 409 },
      );
    return result.rows[0];
  }
  const result = await c.query(
    "INSERT INTO pipeline_opportunities(lead_id,client_id,owner_id,contact_id,quotation_id,quotation_group_id,usd,probability,close_date,evidence_date,data,import_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(import_key) DO NOTHING RETURNING id,version",
    [...values, importKey],
  );
  return result.rows[0];
}
export function registerPipelineRoutes(
  app: Express,
  requireAuth: RequestHandler,
) {
  const router = Router();
  router.use(requireAuth, requirePermission("crm"));
  const wrap =
    (fn: (req: any, res: any) => Promise<any>): RequestHandler =>
    (req, res) => {
      void fn(req, res).catch((e) => {
        const status =
          e.status ??
          (e.code === "40001" ? 409 : e instanceof z.ZodError ? 400 : 400);
        res
          .status(status)
          .json({
            message:
              e.code === "40001"
                ? "Conflicto concurrente. Recargá y reintentá."
                : e.message,
          });
      });
    };
  const selection = async (req: any) => {
    const f = filters.parse(req.query);
    let rows: Opportunity[],
      threshold: number,
      at = new Date().toISOString(),
      period = localDay().slice(0, 7),
      snapshot: any = null;
    if (f.snapshotId) {
      snapshot = (
        await pool.query("SELECT * FROM pipeline_cuts WHERE id=$1", [
          f.snapshotId,
        ])
      ).rows[0];
      if (!snapshot)
        throw Object.assign(new Error("Corte inexistente"), { status: 404 });
      rows = snapshot.payload.rows;
      threshold = snapshot.payload.threshold;
      at = snapshot.payload.evidenceAt ?? snapshot.created_at.toISOString();
      period = snapshot.period;
    } else {
      rows = await currentRows();
      threshold = Number(
        (await pool.query("SELECT threshold FROM pipeline_settings WHERE id=1"))
          .rows[0].threshold,
      );
    }
    rows = visibleRows(rows, req.user).filter(
      (r) =>
        (!f.q ||
          `${r.account} ${r.project ?? ""} ${r.contact ?? ""}`
            .toLowerCase()
            .includes(f.q.toLowerCase())) &&
        (!f.account || r.account === f.account) &&
        (!f.stage || r.stage === f.stage) &&
        (!f.owner || (r.owner ?? "Sin responsable") === f.owner) &&
        (!f.scope || r.scope === f.scope) &&
        (!f.closeMonth ||
          (f.closeMonth === "pending"
            ? !r.closeDate
            : r.closeDate?.startsWith(f.closeMonth))),
    );
    return { rows, threshold, at, period, f, snapshot };
  };
  router.get(
    "/summary",
    wrap(async (req, res) => {
      const s = await selection(req);
      res.json(summarize(s.rows, localDay(new Date(s.at)), s.threshold));
    }),
  );
  for (const endpoint of ["/opportunities", "/alerts"])
    router.get(
      endpoint,
      wrap(async (req, res) => {
        const s = await selection(req);
        const rows = s.rows
          .map((r) => ({ ...r, alerts: alerts(r, localDay(new Date(s.at))) }))
          .filter((r) => (endpoint !== "/alerts" || r.alerts.length) && (!s.f.alert || r.alerts.includes(s.f.alert)));
        const groups = s.f.group
          ? Object.entries(
              Object.groupBy(rows, (r) =>
                s.f.group === "closeMonth"
                  ? (r.closeDate?.slice(0, 7) ?? "Sin fecha de cierre")
                  : String(
                      r[s.f.group as "stage" | "account" | "owner"] ??
                        "Sin responsable",
                    ),
              ),
            ).map(([name, items]) => ({
              name,
              ...summarize(items!, localDay(new Date(s.at)), s.threshold),
            }))
          : [];
        res.json({
          rows: rows.slice(s.f.offset, s.f.offset + s.f.limit),
          total: rows.length,
          groups,
        });
      }),
    );
  router.get(
    "/opportunities/:id",
    wrap(async (req, res) => {
      const s = await selection(req);
      const row = s.rows.find((r) => r.id === Number(req.params.id));
      if (!row) return res.status(404).json({ message: "No encontrada" });
      res.json(row);
    }),
  );
  router.post(
    "/opportunities",
    wrap(async (req, res) => {
      const body = z
        .object({ data: opportunitySchema, reason, requestKey: key })
        .parse(req.body);
      const row = validateOpportunity(body.data);
      if (!visibleRows([row], req.user).length)
        return res
          .status(403)
          .json({ message: "Se requiere acceso a cotizaciones" });
      res.json(
        await transaction(async (c) => {
          const saved = await writeOpportunity(
            c,
            row,
            `manual:${body.requestKey}`,
          );
          if (saved)
            await audit(c, req.user.id, "alta", body.reason, row, saved.id);
          return saved ?? { replayed: true };
        }),
      );
    }),
  );
  router.patch(
    "/opportunities/:id",
    wrap(async (req, res) => {
      const body = z
        .object({ data: opportunitySchema.partial(), reason, version })
        .strict()
        .parse(req.body);
      res.json(
        await transaction(async (c) => {
          const old = (await currentRows(c)).find(
            (r) => r.id === Number(req.params.id),
          );
          if (old && !visibleRows([old], req.user).length)
            throw Object.assign(new Error("Sin acceso a la oportunidad"), {
              status: 403,
            });
          if (!old)
            throw Object.assign(new Error("No encontrada"), { status: 404 });
          const { id, version: _, nativeStage, importKey, ...data } = old;
          const updated = validateOpportunity({ ...data, ...body.data });
          if (!visibleRows([updated], req.user).length)
            throw Object.assign(
              new Error("Se requiere acceso a cotizaciones"),
              { status: 403 },
            );
          if (
            old.status === "Descartada" &&
            updated.status !== "Descartada" &&
            updated.evidence === old.evidence
          )
            throw new Error("La reapertura requiere nueva evidencia");
          const saved = await writeOpportunity(
            c,
            updated,
            null,
            id,
            body.version,
          );
          await audit(
            c,
            req.user.id,
            "edición",
            body.reason,
            { before: data, after: updated },
            id,
          );
          return saved;
        }),
      );
    }),
  );
  router.get(
    "/settings",
    wrap(async (_req, res) =>
      res.json(
        (
          await pool.query(
            "SELECT threshold,version FROM pipeline_settings WHERE id=1",
          )
        ).rows[0],
      ),
    ),
  );
  router.patch(
    "/settings",
    requirePermission("admin"),
    wrap(async (req, res) => {
      const b = z
        .object({ threshold: z.number().min(0).max(100), version, reason })
        .parse(req.body);
      res.json(
        await transaction(async (c) => {
          const r = await c.query(
            "UPDATE pipeline_settings SET threshold=$1,version=version+1 WHERE id=1 AND version=$2 RETURNING *",
            [b.threshold, b.version],
          );
          if (!r.rowCount)
            throw Object.assign(new Error("Recargá la configuración"), {
              status: 409,
            });
          await audit(c, req.user.id, "umbral", b.reason, b);
          return r.rows[0];
        }),
      );
    }),
  );
  router.get(
    "/checklist/:period",
    wrap(async (req, res) => {
      const p = periodSchema.parse(req.params.period);
      res.json(
        (
          await pool.query(
            "SELECT * FROM pipeline_checklists WHERE period=$1",
            [p],
          )
        ).rows[0] ?? {
          period: p,
          steps: [false, false, false, false],
          version: 0,
        },
      );
    }),
  );
  router.patch(
    "/checklist/:period",
    wrap(async (req, res) => {
      const p = periodSchema.parse(req.params.period),
        b = z
          .object({
            steps: z.array(z.boolean()).length(4),
            version: z.number().int().min(0),
            reason,
          })
          .parse(req.body);
      res.json(
        await transaction(async (c) => {
          await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
            "pipeline-checklist:" + p,
          ]);
          const old = (
            await c.query("SELECT * FROM pipeline_checklists WHERE period=$1", [
              p,
            ])
          ).rows[0];
          if ((old?.version ?? 0) !== b.version)
            throw Object.assign(new Error("Recargá el checklist"), {
              status: 409,
            });
          await c.query(
            "INSERT INTO pipeline_checklists(period,steps) VALUES($1,$2) ON CONFLICT(period) DO UPDATE SET steps=$2,version=pipeline_checklists.version+1",
            [p, JSON.stringify(b.steps)],
          );
          await audit(c, req.user.id, "checklist", b.reason, b, null, p);
          return { ok: true };
        }),
      );
    }),
  );
  router.get(
    "/cuts",
    wrap(async (req, res) => {
      const p = req.query.period ? periodSchema.parse(req.query.period) : null;
      res.json(
        (
          await pool.query(
            "SELECT id,period,version,created_at,created_by FROM pipeline_cuts WHERE ($1::text IS NULL OR period=$1) ORDER BY period DESC,version DESC LIMIT 100",
            [p],
          )
        ).rows,
      );
    }),
  );
  router.get(
    "/cuts/:id",
    wrap(async (req, res) => {
      const row = (
        await pool.query("SELECT * FROM pipeline_cuts WHERE id=$1", [
          z.coerce.number().int().positive().parse(req.params.id),
        ])
      ).rows[0];
      if (row) {
        row.payload.rows = visibleRows(row.payload.rows, req.user);
        row.payload.summary = summarize(
          row.payload.rows,
          localDay(new Date(row.payload.evidenceAt ?? row.created_at)),
          row.payload.threshold,
        );
        if (!canSeeQuotations(req.user)) row.payload.decisions = [];
      }
      res.status(row ? 200 : 404).json(row ?? { message: "Corte inexistente" });
    }),
  );
  router.post(
    "/cuts",
    wrap(async (req, res) => {
      const b = z
        .object({ period: periodSchema, requestKey: key, reason })
        .parse(req.body);
      res.json(
        await transaction(async (c) => {
          await c.query(
            "SELECT pg_advisory_xact_lock(hashtext('pipeline-cuts'))",
          );
          const old = (
            await c.query("SELECT id FROM pipeline_cuts WHERE request_key=$1", [
              b.requestKey,
            ])
          ).rows[0];
          if (old) return old;
          const rows = await currentRows(c),
            settings = (
              await c.query("SELECT * FROM pipeline_settings WHERE id=1")
            ).rows[0],
            checklist = (
              await c.query(
                "SELECT * FROM pipeline_checklists WHERE period=$1",
                [b.period],
              )
            ).rows[0];
          const decisions = (
            await c.query(
              "SELECT reason FROM pipeline_log WHERE period=$1 AND kind='decisión' ORDER BY id",
              [b.period],
            )
          ).rows.map((r) => r.reason);
          const payload = {
            rows,
            threshold: Number(settings.threshold),
            checklist,
            decisions,
            rulesVersion: 1,
            staleAfterDays: 30,
            timeZone: "America/Argentina/Buenos_Aires",
            summary: summarize(rows, localDay(), Number(settings.threshold)),
          };
          const r = await c.query(
            "INSERT INTO pipeline_cuts(period,version,request_key,payload,created_by) SELECT $1,COALESCE(MAX(version),0)+1,$2,$3,$4 FROM pipeline_cuts WHERE period=$1 RETURNING id",
            [b.period, b.requestKey, JSON.stringify(payload), req.user.id],
          );
          await audit(
            c,
            req.user.id,
            "corte",
            b.reason,
            r.rows[0],
            null,
            b.period,
          );
          return r.rows[0];
        }),
      );
    }),
  );
  router.get(
    "/executive-summary",
    wrap(async (req, res) => {
      const s = await selection(req);
      const p = s.snapshot
        ? s.period
        : req.query.period
          ? periodSchema.parse(req.query.period)
          : s.period;
      const previous = (
        await pool.query(
          "SELECT * FROM pipeline_cuts WHERE period<$1 ORDER BY period DESC,version DESC LIMIT 1",
          [p],
        )
      ).rows[0];
      let comparison = "Pendiente";
      if (
        previous &&
        !s.f.q &&
        !s.f.account &&
        !s.f.stage &&
        !s.f.owner &&
        !s.f.scope &&
        !s.f.closeMonth
      ) {
        const a = summarize(visibleRows(previous.payload.rows, req.user)),
          b = summarize(s.rows);
        comparison = `${previous.period}: abiertas ${a.open} → ${b.open}; bruto ${a.gross ?? "Pendiente"} (${a.valueCoverage}/${a.open}) → ${b.gross ?? "Pendiente"} (${b.valueCoverage}/${b.open}). Revisar cambios de universo.`;
      }
      const decisions =
        s.snapshot?.payload.decisions ??
        (
          await pool.query(
            "SELECT reason FROM pipeline_log WHERE period=$1 AND kind='decisión'",
            [p],
          )
        ).rows.map((r) => r.reason);
      res.json({
        text: executiveSummary(
          s.rows,
          s.snapshot ? s.period : p,
          s.at,
          s.threshold,
          comparison,
          canSeeQuotations(req.user) ? decisions : [],
        ),
      });
    }),
  );
  router.get(
    "/log",
    requirePermission("quotations"),
    wrap(async (req, res) => {
      const offset = z.coerce
        .number()
        .int()
        .min(0)
        .parse(req.query.offset ?? 0);
      res.json(
        (
          await pool.query(
            "SELECT l.*,concat_ws(' ',u.first_name,u.last_name) AS actor FROM pipeline_log l LEFT JOIN users u ON u.id=l.actor_id ORDER BY l.id DESC LIMIT 100 OFFSET $1",
            [offset],
          )
        ).rows,
      );
    }),
  );
  router.post(
    "/decisions",
    requirePermission("quotations"),
    wrap(async (req, res) => {
      const b = z
        .object({
          reason,
          period: periodSchema,
          opportunityId: z.number().int().positive().nullable().default(null),
        })
        .parse(req.body);
      await transaction((c) =>
        audit(
          c,
          req.user.id,
          "decisión",
          b.reason,
          {},
          b.opportunityId,
          b.period,
        ),
      );
      res.json({ ok: true });
    }),
  );
  app.use("/api/crm/pipeline", router);
}
