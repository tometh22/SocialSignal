const ASANA_BASE = "https://app.asana.com/api/1.0";

function getAsanaToken(): string {
  const token = process.env.ASANA_ACCESS_TOKEN;
  if (!token) {
    throw new Error("ASANA_ACCESS_TOKEN env var no está configurada");
  }
  return token;
}

async function asanaFetch<T = any>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${ASANA_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getAsanaToken()}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Asana ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export type AsanaTimeEntry = {
  gid: string;
  duration_minutes: number;
  entered_on?: string;
  created_at?: string;
  task?: { gid: string; name: string; projects?: Array<{ gid: string; name: string }> };
  created_by?: { gid: string; name: string };
};

export async function listTimeEntries(opts: {
  workspaceGid: string;
  startedOnAfter?: string;
  startedOnBefore?: string;
  userGid?: string;
  limit?: number;
}): Promise<AsanaTimeEntry[]> {
  const entries: AsanaTimeEntry[] = [];
  let offset: string | undefined;
  const pageLimit = opts.limit && opts.limit < 100 ? opts.limit : 100;

  do {
    const resp = await asanaFetch<{
      data: AsanaTimeEntry[];
      next_page?: { offset?: string };
    }>("/time_tracking_entries", {
      workspace: opts.workspaceGid,
      user: opts.userGid,
      "started_on.after": opts.startedOnAfter,
      "started_on.before": opts.startedOnBefore,
      opt_fields: "duration_minutes,entered_on,created_at,task.name,task.projects.name,created_by.name",
      limit: pageLimit,
      offset,
    });
    entries.push(...(resp.data ?? []));
    offset = resp.next_page?.offset;
    if (opts.limit && entries.length >= opts.limit) break;
  } while (offset);

  return entries;
}

/**
 * Agrupa time entries por (userName, projectName, periodKey YYYY-MM)
 * y suma horas. Retorna registros listos para mapear contra aliases.
 */
export function aggregateTimeEntries(entries: AsanaTimeEntry[]) {
  const map = new Map<
    string,
    { userName: string; projectName: string; periodKey: string; hours: number; entryCount: number }
  >();

  for (const e of entries) {
    const user = e.created_by?.name?.trim();
    const project = e.task?.projects?.[0]?.name?.trim();
    const dateStr = e.entered_on || e.created_at?.slice(0, 10);
    if (!user || !project || !dateStr) continue;

    const periodKey = dateStr.slice(0, 7); // YYYY-MM
    const hours = (e.duration_minutes ?? 0) / 60;
    if (hours <= 0) continue;

    const key = `${user}|${project}|${periodKey}`;
    const existing = map.get(key);
    if (existing) {
      existing.hours += hours;
      existing.entryCount += 1;
    } else {
      map.set(key, { userName: user, projectName: project, periodKey, hours, entryCount: 1 });
    }
  }

  return Array.from(map.values());
}
