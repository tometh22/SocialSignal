import { db } from "../db";
import { tasks, taskTimeEntries, taskWeeklyEstimates, personnel, exchangeRates } from "@shared/schema";
import { eq, and, gte, lte, inArray, sql } from "drizzle-orm";

const MONTH_NAMES = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

function getPersonnelMonthField(person: Record<string, any>, year: number, month: number, type: "hourly" | "salary" | "contract"): any {
  if (year === 2025 && month >= 1 && month <= 12) {
    const prefix = MONTH_NAMES[month - 1] + "2025";
    if (type === "hourly") return person[`${prefix}HourlyRateARS`];
    if (type === "salary") return person[`${prefix}MonthlySalaryARS`];
    if (type === "contract") return person[`${prefix}ContractType`];
  }
  return null;
}

export interface PersonHoursCost {
  personnelId: number;
  name: string;
  hours: number;
  costUSD: number;
  rateLabel: string;
  contractType: string;
}

export interface ProjectHoursCost {
  projectId: number;
  totalHours: number;
  totalCostUSD: number;
  byPerson: PersonHoursCost[];
}

export interface TaskHoursCostResult {
  projects: ProjectHoursCost[];
}

export async function getTaskHoursCost(options: {
  projectId?: number;
  dateFrom?: Date;
  dateTo?: Date;
}): Promise<TaskHoursCostResult> {
  const { projectId, dateFrom, dateTo } = options;

  const conditions = [];
  if (dateFrom) conditions.push(gte(taskTimeEntries.date, dateFrom));
  if (dateTo) conditions.push(lte(taskTimeEntries.date, dateTo));

  const entries = conditions.length > 0
    ? await db.select().from(taskTimeEntries).where(and(...conditions))
    : await db.select().from(taskTimeEntries);

  if (entries.length === 0) return { projects: [] };

  const taskIds = [...new Set(entries.map(e => e.taskId))];
  const allTasks = await db.select({ id: tasks.id, projectId: tasks.projectId })
    .from(tasks)
    .where(inArray(tasks.id, taskIds));

  const taskProjectMap: Record<number, number | null> = {};
  allTasks.forEach(t => { taskProjectMap[t.id] = t.projectId; });

  const filteredEntries = projectId
    ? entries.filter(e => taskProjectMap[e.taskId] === projectId)
    : entries;

  if (filteredEntries.length === 0) return { projects: [] };

  const personnelIds = [...new Set(filteredEntries.map(e => e.personnelId).filter(Boolean))] as number[];
  const allPersonnel = personnelIds.length > 0
    ? await db.select().from(personnel).where(inArray(personnel.id, personnelIds))
    : [];

  const personnelMap: Record<number, any> = {};
  allPersonnel.forEach(p => { personnelMap[p.id] = p; });

  const yearMonthSet = new Set<string>();
  filteredEntries.forEach(e => {
    const d = new Date(e.date);
    yearMonthSet.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
  });

  const fxMap: Record<string, number> = {};
  for (const ym of yearMonthSet) {
    const [y, m] = ym.split("-").map(Number);
    const [row] = await db.select({ rate: exchangeRates.rate })
      .from(exchangeRates)
      .where(and(eq(exchangeRates.year, y), eq(exchangeRates.month, m)))
      .limit(1);
    if (row?.rate) {
      fxMap[ym] = Number(row.rate);
    }
  }

  const projectMap: Record<number, { byPerson: Record<number, PersonHoursCost>; totalHours: number; totalCostUSD: number }> = {};

  for (const entry of filteredEntries) {
    const pid = taskProjectMap[entry.taskId];
    if (pid === null || pid === undefined) continue;
    if (pid >= 1_000_000) continue;

    const person = entry.personnelId ? personnelMap[entry.personnelId] : null;
    const d = new Date(entry.date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const fxKey = `${year}-${month}`;
    const fx = fxMap[fxKey] || 1000;

    let costUSD = 0;
    let rateLabel = "sin tarifa";
    let contractType = "desconocido";

    if (person) {
      const monthlyContractType = getPersonnelMonthField(person, year, month, "contract") || person.contractType || "full-time";
      contractType = monthlyContractType;

      if (monthlyContractType === "full-time") {
        const monthlySalaryARS = getPersonnelMonthField(person, year, month, "salary") || person.monthlyFixedSalary;
        if (monthlySalaryARS && monthlySalaryARS > 0) {
          const hourlyARS = monthlySalaryARS / 160;
          costUSD = (entry.hours * hourlyARS) / fx;
          rateLabel = `ARS ${Math.round(hourlyARS).toLocaleString()}/h`;
        } else if (person.hourlyRateARS && person.hourlyRateARS > 0) {
          costUSD = (entry.hours * person.hourlyRateARS) / fx;
          rateLabel = `ARS ${Math.round(person.hourlyRateARS).toLocaleString()}/h`;
        } else {
          costUSD = entry.hours * (person.hourlyRate || 0);
          rateLabel = `USD ${person.hourlyRate || 0}/h`;
        }
      } else {
        const hourlyRateARS = getPersonnelMonthField(person, year, month, "hourly") || person.hourlyRateARS;
        if (hourlyRateARS && hourlyRateARS > 0) {
          costUSD = (entry.hours * hourlyRateARS) / fx;
          rateLabel = `ARS ${Math.round(hourlyRateARS).toLocaleString()}/h`;
        } else {
          costUSD = entry.hours * (person.hourlyRate || 0);
          rateLabel = `USD ${person.hourlyRate || 0}/h`;
        }
      }
    }

    if (!projectMap[pid]) {
      projectMap[pid] = { byPerson: {}, totalHours: 0, totalCostUSD: 0 };
    }
    const proj = projectMap[pid];
    proj.totalHours += entry.hours;
    proj.totalCostUSD += costUSD;

    if (entry.personnelId && person) {
      if (!proj.byPerson[entry.personnelId]) {
        proj.byPerson[entry.personnelId] = {
          personnelId: entry.personnelId,
          name: person.name || `Persona #${entry.personnelId}`,
          hours: 0,
          costUSD: 0,
          rateLabel,
          contractType,
        };
      }
      proj.byPerson[entry.personnelId].hours += entry.hours;
      proj.byPerson[entry.personnelId].costUSD += costUSD;
    }
  }

  const projects: ProjectHoursCost[] = Object.entries(projectMap).map(([pid, data]) => ({
    projectId: Number(pid),
    totalHours: Math.round(data.totalHours * 100) / 100,
    totalCostUSD: Math.round(data.totalCostUSD * 100) / 100,
    byPerson: Object.values(data.byPerson).sort((a, b) => b.hours - a.hours),
  }));

  return { projects };
}

// Hours-only shape (no cost fields) used by the Rentabilidad screen's
// GET /api/projects/:id/profitability-time-entries, which needs task hours
// merged alongside legacy time_entries but recomputes cost itself from the
// personnel query — keeping cost fields out of this response avoids the
// ARS/USD ambiguity of mixing task_time_entries' ARS-denominated
// hourlyRateAtTime with legacy entries of uncertain currency.
export interface ProjectTaskHourEntry {
  id: number;
  personnelId: number;
  personnelName: string | null;
  hours: number;
  description: string | null;
  date: Date;
  source: "task";
}

// Offset applied to task_time_entries.id so its rows never collide with a
// real time_entries.id (both are serial PKs starting at 1) when merged
// into one array on the client.
const TASK_ENTRY_ID_OFFSET = 1_000_000_000;

/**
 * Returns the task_time_entries logged against this project's tasks, mapped
 * to a hours-only shape for the Rentabilidad screen.
 */
export async function getTaskTimeEntriesForProject(projectId: number): Promise<{
  entries: ProjectTaskHourEntry[];
}> {
  const projectTasks = await db.select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));

  if (projectTasks.length === 0) return { entries: [] };

  const taskIds = projectTasks.map(t => t.id);
  const rows = await db.select({
    id: taskTimeEntries.id,
    personnelId: taskTimeEntries.personnelId,
    hours: taskTimeEntries.hours,
    description: taskTimeEntries.description,
    date: taskTimeEntries.date,
    personnelName: personnel.name,
  })
    .from(taskTimeEntries)
    .innerJoin(personnel, eq(taskTimeEntries.personnelId, personnel.id))
    .where(inArray(taskTimeEntries.taskId, taskIds));

  const entries: ProjectTaskHourEntry[] = rows.map(r => ({
    id: TASK_ENTRY_ID_OFFSET + r.id,
    personnelId: r.personnelId,
    personnelName: r.personnelName,
    hours: r.hours,
    description: r.description,
    date: new Date(r.date),
    source: "task",
  }));

  return { entries };
}

/**
 * Sums every weekly planning estimate (task_weekly_estimates) entered for
 * this project's tasks. Unlike the quotation's fixed estimatedHours, this
 * reflects the team's week-by-week re-estimation as the work evolves.
 */
export async function getProjectPlannedHoursFromWeeklyEstimates(projectId: number): Promise<number> {
  const [row] = await db.select({ total: sql<number>`COALESCE(SUM(${taskWeeklyEstimates.estimatedHours}), 0)` })
    .from(taskWeeklyEstimates)
    .innerJoin(tasks, eq(taskWeeklyEstimates.taskId, tasks.id))
    .where(eq(tasks.projectId, projectId));

  return Math.round((Number(row?.total) || 0) * 100) / 100;
}
