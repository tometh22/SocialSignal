import { z } from "zod";

export const notificationCategories = [
  "mind",
  "daily",
  "tasks",
  "crm",
  "team",
  "quotations",
] as const;
export type NotificationCategory = (typeof notificationCategories)[number];
export const notificationSettingsSchema = z
  .object({
    activityEmailMode: z.enum(["immediate", "daily", "off"]).default("daily"),
    digestHour: z.number().int().min(0).max(23).default(9),
    timeZone: z
      .string()
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("es", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      })
      .default("America/Argentina/Buenos_Aires"),
    quietHours: z
      .object({
        enabled: z.boolean(),
        start: z.number().int().min(0).max(23),
        end: z.number().int().min(0).max(23),
      })
      .strict()
      .default({ enabled: false, start: 20, end: 9 }),
  })
  .strict();
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
export const defaultNotificationSettings = notificationSettingsSchema.parse({});
export function notificationCategory(
  type: string,
): NotificationCategory | null {
  if (type === "mind_daily") return "daily";
  if (type === "mind_reply") return "mind";
  if (["task_assigned", "task_reply"].includes(type)) return "tasks";
  if (type === "crm_reminder") return "crm";
  if (
    [
      "absence",
      "absence_request",
      "absence_cancellation",
      "absence_decision",
      "monthly_settlement",
    ].includes(type)
  )
    return "team";
  if (type === "quotation_approval") return "quotations";
  return null;
}
export const isActivityNotification = (type: string) =>
  ["mind_daily", "mind_reply", "task_reply"].includes(type);
export const notificationTypes = [
  "mind_daily",
  "mind_reply",
  "task_assigned",
  "task_reply",
  "crm_reminder",
  "quotation_approval",
  "absence",
  "absence_request",
  "absence_cancellation",
  "absence_decision",
  "monthly_settlement",
] as const;

// Advance on the UTC timeline to handle midnight and daylight-saving transitions.
export function notificationSendAt(
  now: Date,
  settings: NotificationSettings,
  digest = false,
): Date {
  const result = new Date(now);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: settings.timeZone,
  });
  const clock = () => formatter.format(result).split(":").map(Number);
  const advance = () => result.setUTCMinutes(result.getUTCMinutes() + 60 - clock()[1], 0, 0);
  if (digest) {
    advance();
    while (clock()[0] !== settings.digestHour || clock()[1] !== 0) advance();
  }
  const { enabled, start, end } = settings.quietHours;
  if (enabled && start !== end) {
    const quiet = (hour: number) =>
      start < end ? hour >= start && hour < end : hour >= start || hour < end;
    while (quiet(clock()[0])) advance();
  }
  return result;
}

export function safeNotificationPath(value?: string | null) {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return "/notifications";
  try {
    const url = new URL(value, "https://mind.invalid");
    return url.origin === "https://mind.invalid"
      ? `${url.pathname}${url.search}${url.hash}`
      : "/notifications";
  } catch {
    return "/notifications";
  }
}

export type GroupableNotification = {
  id: number;
  type: string;
  actionUrl: string | null;
  entityType: string | null;
  entityId: number | null;
  createdAt: string;
  readAt: string | null;
  threadKey?: string | null;
};
export function groupNotifications<T extends GroupableNotification>(
  items: T[],
) {
  const groups: { key: string; items: T[]; latest: T; unreadIds: number[] }[] =
    [];
  const active = new Map<string, (typeof groups)[number]>();
  for (const item of [...items].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
      b.id - a.id,
  )) {
    const time = new Date(item.createdAt);
    const day = `${time.getFullYear()}-${time.getMonth()}-${time.getDate()}`;
    const key = `${day}:${item.type}:${item.threadKey || item.actionUrl || `${item.entityType}:${item.entityId ?? item.id}`}`;
    const current = active.get(key);
    const windowMs = (item.type === "mind_daily" ? 24 : 4) * 3600_000;
    if (
      isActivityNotification(item.type) &&
      current &&
      Math.abs(new Date(current.latest.createdAt).getTime() - time.getTime()) <=
        windowMs
    ) {
      current.items.push(item);
      if (!item.readAt) current.unreadIds.push(item.id);
    } else {
      const group = {
        key: `${key}:${item.id}`,
        latest: item,
        items: [item],
        unreadIds: item.readAt ? [] : [item.id],
      };
      groups.push(group);
      active.set(key, group);
    }
  }
  return groups;
}
