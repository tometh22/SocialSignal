/** Private input only. Never check the annex or the generated preview into git. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  opportunitySchema,
  summarize,
  type Opportunity,
} from "../shared/pipeline";
const args = process.argv.slice(2);
const file = args[0];
if (!file)
  throw new Error(
    "Uso: npx tsx scripts/prepare-pipeline-import.ts archivo.md [--database] [--apply manifest.json]",
  );
const raw = readFileSync(file, "utf8");
const annex = JSON.parse(
  raw.includes("```json") ? raw.split("```json")[1].split("```")[0] : raw,
);
const hash = createHash("sha256").update(JSON.stringify(annex)).digest("hex");
const rows: Opportunity[] = annex.rows.map((r: any, i: number) => ({
  ...opportunitySchema.parse({
    ...annex.defaults,
    account: r.account,
    project: r.project ?? null,
    contact: r.contact ?? null,
    owner: r.owner ?? null,
    stage: r.stage ?? annex.defaults.stage,
    status: r.status ?? annex.defaults.status,
    scope: r.scope ?? annex.defaults.scope,
    confidence: r.confidence ?? annex.defaults.confidence,
    usd: r.usd === undefined ? null : String(r.usd),
    valueNote: r.valueNote ?? null,
    next: r.next ?? null,
    nextDate: r.nextDate ?? null,
    evidence: r.evidence ?? null,
    evidenceDate: r.evidenceDate ?? null,
    warner: r.warner ?? false,
    warnerBasis: r.warner ? "Mapeo explícito del anexo histórico" : null,
    leadId: r.mindLeadId ?? null,
    sources: r.sources.map((s: any, j: number) => ({
      key: `${r.id}:${j}`,
      title: s.title,
      url: s.url,
      kind: s.title.startsWith("Mind · COT")
        ? "quotation"
        : s.title.startsWith("Mind")
          ? "crm"
          : "external",
    })),
  }),
  id: -(i + 1),
  importKey: `historical:${annex.localCutDate}:${r.id}`,
}));
for (const values of annex.reviewCrmRows) {
  const r = Object.fromEntries(
    annex.reviewCrmColumns.map((k: string, i: number) => [k, values[i]]),
  );
  rows.push({
    ...opportunitySchema.parse({
      account: r.account,
      project: r.project,
      contact: r.contact,
      leadId: r.mindLeadId,
      stage: r.stage,
      status: r.status,
      confidence: r.confidence,
      scope: "Validación CRM",
      legacyEstimatedUsd:
        r.legacyEstimatedUsd === null ? null : String(r.legacyEstimatedUsd),
      crmUpdatedAtReference: r.crmUpdatedAtReference,
      notes:
        "Actualización técnica del CRM; evidencia comercial pendiente de corroborar.",
      sources: [
        {
          key: `crm:${r.mindLeadId}`,
          title: "Mind · ficha del lead",
          url: `https://mind.epical.digital/crm/${r.mindLeadId}`,
          kind: "crm",
        },
      ],
    }),
    id: -(rows.length + 1),
    nativeStage: r.nativeStageLabel,
    importKey: `historical:${annex.localCutDate}:crm:${r.mindLeadId}`,
  });
}
const report: any = {
  inputHash: hash,
  period: annex.period,
  capturedAtUtc: annex.capturedAtUtc,
  localCutDate: annex.localCutDate,
  summary: summarize(rows, annex.localCutDate, annex.concentrationThresholdPct),
  counts: Object.fromEntries(
    ["Pipeline", "Cerrada / confirmada", "Validación CRM", "Descartada"].map(
      (s) => [s, rows.filter((r) => r.scope === s).length],
    ),
  ),
  databaseReconciled: false,
  rows: rows.map((r) => ({
    importKey: r.importKey,
    account: r.account,
    project: r.project,
    leadId: r.leadId,
    action: "Revisión pendiente",
    sources: r.sources,
  })),
};
if (args.includes("--database") || args.includes("--apply")) {
  const { pool } = await import("../server/db");
  const { transaction, audit, writeOpportunity } =
    await import("../server/pipeline/routes");
  try {
    const leads = (
      await pool.query(
        "SELECT id,company_name,opportunity_name,stage,updated_at,assigned_to,client_id,quotation_group_id FROM crm_leads",
      )
    ).rows;
    const quotes = (
      await pool.query(
        "SELECT id,quotation_number,revision_number,client_id,project_name FROM quotations",
      )
    ).rows;
    const users = (
      await pool.query(
        "SELECT id, concat_ws(' ',first_name,last_name) AS name FROM users",
      )
    ).rows;
    for (const item of report.rows) {
      const historical = rows.find((r) => r.importKey === item.importKey)!;
      item.leadCandidates = leads.filter((l) =>
        historical.leadId
          ? l.id === historical.leadId
          : l.company_name === historical.account,
      );
      item.quotationCandidates = quotes.filter((q) =>
        item.sources.some((s: any) => s.title.includes(q.quotation_number)),
      );
      item.ownerCandidates = users.filter((u) => u.name === historical.owner);
      item.action =
        item.leadCandidates.length === 1
          ? "Vínculo encontrado; comparar evidencia actual antes de promover"
          : "Conciliar vínculo";
    }
    report.databaseReconciled = true;
    if (args.includes("--apply")) {
      const manifest = JSON.parse(
        readFileSync(args[args.indexOf("--apply") + 1], "utf8"),
      );
      if (
        manifest.inputHash !== hash ||
        !manifest.reason?.trim() ||
        !Number.isInteger(manifest.actorId)
      )
        throw new Error("Manifest requiere inputHash, actorId y reason");
      const user = (
        await pool.query("SELECT * FROM users WHERE id=$1", [manifest.actorId])
      ).rows[0];
      if (
        !user ||
        !(
          user.is_admin ||
          user.role === "admin" ||
          user.permissions?.includes("crm")
        )
      )
        throw new Error("Actor sin permiso CRM");
      await transaction(async (c) => {
        await c.query(
          "SELECT pg_advisory_xact_lock(hashtext('pipeline-cuts'))",
        );
        const requestKey = `historical:${hash}`;
        const old = await c.query(
          "SELECT id FROM pipeline_cuts WHERE request_key=$1",
          [requestKey],
        );
        if (!old.rowCount) {
          const payload = {
            rows,
            summary: report.summary,
            threshold: annex.concentrationThresholdPct,
            rulesVersion: 1,
            staleAfterDays: 30,
            evidenceAt: annex.capturedAtUtc,
            checklist: [false, false, false, false],
            decisions: [manifest.reason],
            sourceHash: hash,
          };
          await c.query(
            "INSERT INTO pipeline_cuts(period,version,request_key,payload,created_by) SELECT $1,COALESCE(MAX(version),0)+1,$2,$3,$4 FROM pipeline_cuts WHERE period=$1",
            [
              annex.period,
              requestKey,
              JSON.stringify(payload),
              manifest.actorId,
            ],
          );
          await audit(
            c,
            manifest.actorId,
            "carga histórica",
            manifest.reason,
            { inputHash: hash },
            null,
            annex.period,
          );
        }
        // Live promotion is explicit per scope, with current evidence and stable links.
        for (const approved of manifest.live ?? []) {
          const original = rows.find((r) => r.importKey === approved.importKey);
          if (!original) throw new Error("Clave de origen desconocida");
          const { id, version, importKey, nativeStage, ...data } = original;
          const { validateOpportunity } = await import("../shared/pipeline");
          const updated = validateOpportunity({ ...data, ...approved.data });
          if (!approved.reason?.trim())
            throw new Error("Cada promoción requiere motivo");
          const saved = await writeOpportunity(c, updated, original.importKey);
          if (saved)
            await audit(
              c,
              manifest.actorId,
              "conciliación inicial",
              approved.reason,
              { inputHash: hash, after: updated },
              saved.id,
            );
        }
      });
      report.applied = true;
    }
  } finally {
    await pool.end();
  }
}
writeFileSync(
  ".context/pipeline-reconciliation-preview.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    {
      counts: report.counts,
      summary: report.summary,
      databaseReconciled: report.databaseReconciled,
      applied: report.applied ?? false,
    },
    null,
    2,
  ),
);
