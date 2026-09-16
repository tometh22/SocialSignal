import { apiRequest, authFetchJson } from "@/lib/queryClient";

export type ObjectiveRef = string | number | { id?: string | number | null; name?: string | null; title?: string | null };

export type Objective = {
  id: string | number;
  slug?: string | null;
  level: string;
  areaKey?: string | null;
  title: string;
  metric?: string | null;
  target?: string | number | null;
  targetKind?: "metric" | "milestone" | "continuous" | null;
  targetValue?: string | number | null;
  targetUnit?: string | null;
  targetDate?: string | null;
  currentValue?: string | number | null;
  progressPercent?: number | null;
  status?: string | null;
  owner?: ObjectiveRef | null;
  parentObjectiveId?: string | number | null;
};

export type ObjectiveAction = {
  id: string | number;
  slug?: string | null;
  objectiveId: string | number | null;
  objectiveTitle?: string | null;
  accountId?: string | number | null;
  accountName?: string | null;
  title: string;
  description?: string | null;
  month?: string | number | null;
  weekLabel?: string | null;
  weekStart?: string | null;
  dueDate?: string | null;
  focus?: string | null;
  status?: string | null;
  accountableOwner?: ObjectiveRef | null;
  supportingOwners?: ObjectiveRef[] | null;
  evidence?: string | null;
  dependencyActionIds?: Array<string | number> | null;
};

export type ObjectiveAccount = {
  id: string | number;
  name: string;
};

export type ObjectiveSummary = {
  totalObjectives: number;
  totalActions: number;
  completedActions: number;
  atRiskObjectives: number;
  currentWeekStart?: string | null;
};

export type ObjectivesResponse = {
  objectives: Objective[];
  actions: ObjectiveAction[];
  accounts: ObjectiveAccount[];
  owners: ObjectiveRef[];
  summary: ObjectiveSummary;
};

export type CreateObjectiveActionInput = {
  slug?: string;
  title: string;
  objectiveId: string | number;
  accountableOwner: string;
  weekLabel: string;
  weekStart?: string;
  dueDate?: string;
  accountId?: string;
  focus?: string;
};

export type UpdateObjectiveActionInput = Partial<{
  status: string;
  title: string;
  objectiveId: string | number;
  accountableOwner: string;
  weekLabel: string;
  weekStart: string;
  dueDate: string;
  accountId: string;
  focus: string;
}>;

export type UpdateObjectiveInput = Partial<{
  currentValue: string | number | null;
  status: string;
  progressPercent: number | null;
}>;

export const objectivesQueryKey = (year: number) => ["/api/objectives", year] as const;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeAccount(account: unknown, index: number): ObjectiveAccount | null {
  if (typeof account === "string" || typeof account === "number") {
    return { id: account, name: String(account) };
  }
  if (!account || typeof account !== "object") return null;
  const candidate = account as { id?: string | number; name?: string; title?: string };
  const name = candidate.name ?? candidate.title;
  if (!name) return null;
  return { id: candidate.id ?? `account-${index}`, name };
}

export async function getObjectives(year: number): Promise<ObjectivesResponse> {
  const response = await authFetchJson<Partial<ObjectivesResponse>>(`/api/objectives?year=${encodeURIComponent(year)}`);
  const accounts = asArray<unknown>(response?.accounts)
    .map(normalizeAccount)
    .filter((account): account is ObjectiveAccount => Boolean(account));

  return {
    objectives: asArray<Objective>(response?.objectives),
    actions: asArray<ObjectiveAction>(response?.actions),
    accounts,
    owners: asArray<ObjectiveRef>(response?.owners),
    summary: {
      totalObjectives: response?.summary?.totalObjectives ?? 0,
      totalActions: response?.summary?.totalActions ?? 0,
      completedActions: response?.summary?.completedActions ?? 0,
      atRiskObjectives: response?.summary?.atRiskObjectives ?? 0,
      currentWeekStart: response?.summary?.currentWeekStart ?? null,
    },
  };
}

export function createObjectiveAction(input: CreateObjectiveActionInput) {
  return apiRequest("/api/objectives/actions", "POST", input);
}

export function updateObjectiveAction(id: string | number, input: UpdateObjectiveActionInput) {
  return apiRequest(`/api/objectives/actions/${encodeURIComponent(String(id))}`, "PATCH", input);
}

export function updateObjective(id: string | number, input: UpdateObjectiveInput) {
  return apiRequest(`/api/objectives/${encodeURIComponent(String(id))}`, "PATCH", input);
}
