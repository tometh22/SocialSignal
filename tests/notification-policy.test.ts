import { describe, it, expect } from "vitest";
import {
  defaultNotificationSettings,
  notificationSettingsSchema,
  notificationSendAt,
  groupNotifications,
  safeNotificationPath,
  notificationCategory,
} from "../shared/utils/notification-policy";
const settings = { ...defaultNotificationSettings, timeZone: "UTC" };
const n = (id: number, time: string, threadKey = "topic:1") => ({
  id,
  type: "mind_reply",
  entityType: "review_room",
  entityId: 1,
  actionUrl: `/review/1?noteId=${id}`,
  threadKey,
  createdAt: time,
  readAt: null,
});
describe("notification policy", () => {
  it("groups historical replies by their event times and keeps different topics separate", () => {
    expect(
      groupNotifications([
        n(2, "2020-01-01T10:05:00Z"),
        n(1, "2020-01-01T10:00:00Z"),
      ]),
    ).toHaveLength(1);
    expect(
      groupNotifications([
        n(2, "2020-01-01T18:00:00Z"),
        n(1, "2020-01-01T10:00:00Z"),
      ]),
    ).toHaveLength(2);
    expect(
      groupNotifications([
        n(2, "2020-01-01T10:05:00Z", "topic:2"),
        n(1, "2020-01-01T10:00:00Z"),
      ]),
    ).toHaveLength(2);
  });
  it("keeps every unread ID in a large group without mixing read state", () => {
    const items = Array.from({ length: 125 }, (_, i) =>
      n(i + 1, "2020-01-01T10:00:00Z"),
    );
    expect(groupNotifications(items)[0].unreadIds).toHaveLength(125);
  });
  it("defers across midnight, with exact boundaries and local digest times", () => {
    const quiet = {
      ...settings,
      quietHours: { enabled: true, start: 20, end: 9 },
    };
    expect(
      notificationSendAt(new Date("2026-11-04T22:15:00Z"), quiet).toISOString(),
    ).toBe("2026-11-05T09:00:00.000Z");
    expect(
      notificationSendAt(new Date("2026-11-04T09:00:00Z"), quiet).toISOString(),
    ).toBe("2026-11-04T09:00:00.000Z");
    expect(
      notificationSendAt(
        new Date("2026-11-04T09:00:00Z"),
        settings,
        true,
      ).toISOString(),
    ).toBe("2026-11-05T09:00:00.000Z");
    expect(
      notificationSendAt(
        new Date("2026-11-04T00:00:00Z"),
        { ...settings, timeZone: "Asia/Kathmandu" },
        true,
      ).toISOString(),
    ).toBe("2026-11-04T03:15:00.000Z");
    expect(
      notificationSendAt(
        new Date("2026-03-08T06:00:00Z"),
        { ...settings, timeZone: "America/New_York", digestHour: 9 },
        true,
      ).toISOString(),
    ).toBe("2026-03-08T13:00:00.000Z");
  });
  it("validates scheduling and denies unknown event categories and unsafe links", () => {
    expect(
      notificationSettingsSchema.safeParse({ ...settings, timeZone: "invalid" })
        .success,
    ).toBe(false);
    expect(notificationCategory("unknown")).toBeNull();
    for (const path of [
      "//evil.test",
      "/\\evil.test",
      "https://evil.test",
      "/\n//evil.test",
    ])
      expect(safeNotificationPath(path)).toBe("/notifications");
    expect(safeNotificationPath("/review/1?item=p_1&noteId=2")).toBe(
      "/review/1?item=p_1&noteId=2",
    );
  });
});
