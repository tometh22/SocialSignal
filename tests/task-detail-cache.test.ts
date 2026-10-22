import { describe, expect, it } from "vitest";
import { mergeTaskAssignment } from "../client/src/lib/task-detail-cache";
import { taskHourAttribution } from "../shared/utils/task-hour-owner";

describe("task assignment and hours owner cache", () => {
  const people = [{ id: 1, name: "Ana" }, { id: 2, name: "Bruno" }];
  const before = { assigneeId: 1 as number | null, assigneeName: "Ana", hoursOwnerId: 1 as number | null, hoursOwnerName: "Ana", title: "Informe", timeEntries: [{ personnelId: 1, hours: 2 }] };

  it("allows the next new entry for the new owner without retaining the previous recipient", () => {
    const after = mergeTaskAssignment(before, { assigneeId: 2 }, people);
    expect(taskHourAttribution(2, null, true, after.hoursOwnerId)).toEqual({ personnelId: 2 });
    expect(after.hoursOwnerName).toBe("Bruno");
    expect(after.assigneeName).toBe("Bruno");
    expect(after.timeEntries).toEqual([{ personnelId: 1, hours: 2 }]);
    expect(before.hoursOwnerId).toBe(1);
  });

  it("clears the previous destination when unassigning, until an inherited owner is fetched", () => {
    const after = mergeTaskAssignment(before, { assigneeId: null }, people);
    expect(after.hoursOwnerId).toBeNull();
    expect(after.hoursOwnerName).toBeNull();
    expect(taskHourAttribution(after.hoursOwnerId, null, true)).toMatchObject({ status: 400 });
  });

  it("preserves inherited attribution during unrelated edits", () => {
    const inherited = { ...before, assigneeId: null };
    expect(mergeTaskAssignment(inherited, { title: "Informe actualizado" }, people)).toMatchObject({ title: "Informe actualizado", hoursOwnerId: 1, hoursOwnerName: "Ana" });
  });
});
