import { describe, expect, it } from "vitest";
import { assignmentActor, isDelegatedToOthers } from "../shared/utils/task-assignment";
import { insertTaskSchema } from "../shared/schema";

describe("task assignment attribution", () => {
  it("records the actor on creation with an assignee or collaborators", () => {
    expect(assignmentActor({}, { assigneeId: 7 }, 42)).toBe(42);
    expect(assignmentActor({}, { collaboratorIds: [7] }, 42)).toBe(42);
    expect(assignmentActor({}, {}, 42)).toBeNull();
  });
  it("records reassignment by someone other than the creator", () => {
    expect(assignmentActor({ assigneeId: 7, assignedBy: 42 }, { assigneeId: 8 }, 99)).toBe(99);
    expect(assignmentActor({ assigneeId: 7, assignedBy: 42 }, { collaboratorIds: [8] }, 99)).toBe(99);
  });
  it("does not steal attribution for unchanged assignments, removals, or other edits", () => {
    const current = { assigneeId: 7, collaboratorIds: [8, 9], assignedBy: 42 };
    expect(assignmentActor(current, {}, 99)).toBe(42);
    expect(assignmentActor(current, { assigneeId: 7, collaboratorIds: [9, 8] }, 99)).toBe(42);
    expect(assignmentActor(current, { collaboratorIds: [8] }, 99)).toBe(42);
    expect(assignmentActor(current, { assigneeId: null, collaboratorIds: [] }, 99)).toBeNull();
  });
  it("does not infer attribution for historical tasks", () => {
    expect(assignmentActor({ assigneeId: 7 }, {}, 42)).toBeNull();
  });
  it("separates user IDs from personnel IDs and excludes self-only assignments", () => {
    expect(isDelegatedToOthers({ assigneeId: 7 }, 7)).toBe(false);
    expect(isDelegatedToOthers({ collaboratorIds: [7] }, 7)).toBe(false);
    expect(isDelegatedToOthers({ assigneeId: 7, collaboratorIds: [8] }, 7)).toBe(true);
    expect(isDelegatedToOthers({ assigneeId: 8 }, null)).toBe(true);
    expect(isDelegatedToOthers({}, null)).toBe(false);
  });
  it("does not accept a spoofed assignment actor from creation payloads", () => {
    const parsed = insertTaskSchema.parse({ title: "Prueba", projectId: 1, assignedBy: 999 });
    expect(parsed).not.toHaveProperty("assignedBy");
  });
});
