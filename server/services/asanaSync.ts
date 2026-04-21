import { db } from "../db";
import {
  activeProjects,
  clients,
  factLaborMonth,
  personnel,
  personnelAliases,
  projectAliases,
} from "../../shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { aggregateTimeEntries, listTimeEntries, type AsanaTimeEntry } from "./asanaApi";

type AggregatedEntry = ReturnType<typeof aggregateTimeEntries>[number];

type MatchedRow = AggregatedEntry & {
  projectId: number;
  personId: number;
};

type UnmatchedRow = AggregatedEntry & {
  reason: "project_alias_missing" | "personnel_alias_missing";
};

async function resolveMapping(entries: AggregatedEntry[]): Promise<{
  matched: MatchedRow[];
  unmatched: UnmatchedRow[];
}> {
  const matched: MatchedRow[] = [];
  const unmatched: UnmatchedRow[] = [];

  for (const e of entries) {
    const projectRows = await db
      .select({ projectId: projectAliases.projectId })
      .from(projectAliases)
      .innerJoin(activeProjects, eq(projectAliases.projectId, activeProjects.id))
      .innerJoin(clients, eq(activeProjects.clientId, clients.id))
      .where(
        and(
          eq(projectAliases.isActive, true),
          sql`lower(${projectAliases.excelProject}) = lower(${e.projectName})`,
        ),
      )
      .limit(1);

    if (projectRows.length === 0) {
      unmatched.push({ ...e, reason: "project_alias_missing" });
      continue;
    }

    const personRows = await db
      .select({ personnelId: personnelAliases.personnelId })
      .from(personnelAliases)
      .where(
        and(
          eq(personnelAliases.isActive, true),
          sql`lower(${personnelAliases.excelName}) = lower(${e.userName})`,
        ),
      )
      .limit(1);

    if (personRows.length === 0) {
      unmatched.push({ ...e, reason: "personnel_alias_missing" });
      continue;
    }

    matched.push({
      ...e,
      projectId: projectRows[0].projectId,
      personId: personRows[0].personnelId,
    });
  }

  return { matched, unmatched };
}

async function upsertMatched(matched: MatchedRow[]) {
  const summary = { inserted: 0, updated: 0 };

  for (const row of matched) {
    const person = await db
      .select({ id: personnel.id, name: personnel.name })
      .from(personnel)
      .where(eq(personnel.id, row.personId))
      .limit(1);
    const personKey = person[0]?.name?.trim() ?? row.userName;

    const existing = await db
      .select({ id: factLaborMonth.id })
      .from(factLaborMonth)
      .where(
        and(
          eq(factLaborMonth.projectId, row.projectId),
          eq(factLaborMonth.personKey, personKey),
          eq(factLaborMonth.periodKey, row.periodKey),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(factLaborMonth)
        .set({
          asanaHours: String(row.hours),
          personId: row.personId,
          sourceRowId: `asana-api:${row.periodKey}:${row.projectId}:${row.personId}`,
          loadedAt: new Date(),
        })
        .where(eq(factLaborMonth.id, existing[0].id));
      summary.updated += 1;
    } else {
      await db.insert(factLaborMonth).values({
        projectId: row.projectId,
        personId: row.personId,
        periodKey: row.periodKey,
        personKey,
        asanaHours: String(row.hours),
        sourceRowId: `asana-api:${row.periodKey}:${row.projectId}:${row.personId}`,
      });
      summary.inserted += 1;
    }
  }

  return summary;
}

export async function previewAsanaHours(opts: {
  workspaceGid: string;
  startedOnAfter: string;
  startedOnBefore: string;
}): Promise<{
  totalEntries: number;
  aggregated: AggregatedEntry[];
  matched: MatchedRow[];
  unmatched: UnmatchedRow[];
}> {
  const rawEntries: AsanaTimeEntry[] = await listTimeEntries(opts);
  const aggregated = aggregateTimeEntries(rawEntries);
  const { matched, unmatched } = await resolveMapping(aggregated);
  return { totalEntries: rawEntries.length, aggregated, matched, unmatched };
}

export async function importAsanaHours(opts: {
  workspaceGid: string;
  startedOnAfter: string;
  startedOnBefore: string;
}) {
  const preview = await previewAsanaHours(opts);
  const summary = await upsertMatched(preview.matched);
  return {
    ...summary,
    matchedCount: preview.matched.length,
    unmatchedCount: preview.unmatched.length,
    totalEntries: preview.totalEntries,
    unmatched: preview.unmatched,
  };
}
