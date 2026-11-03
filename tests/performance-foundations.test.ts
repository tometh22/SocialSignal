import { describe, expect, it, vi } from "vitest";
import { cursorPage, escapeLike, readPage } from "../server/utils/pagination";
import { privateTaskIds, personalTaskHours } from "../server/services/task-hour-privacy";
import { ReadCache } from "../server/utils/read-cache";

describe("bounded reads and privacy", () => {
  it("rejects invalid cursors instead of accidentally loading the full history", () => {
    expect(readPage({})).toBeNull();
    for (const limit of [-1, 0, 201, "bad", 1.5]) expect(() => readPage({ limit })).toThrow();
    expect(() => readPage({ limit: 50, beforeId: -1 })).toThrow();
    expect(cursorPage([{ id: 9 }, { id: 8 }, { id: 7 }], 2)).toEqual({ items: [{ id: 9 }, { id: 8 }], nextCursor: 8 });
    expect(escapeLike("50%_\\")).toBe("50\\%\\_\\\\");
  });
  it("does not query hours for comments and collects repeated task rows once", () => {
    expect(privateTaskIds([{ id: 1, taskId: 7, content: "Comment" }])).toEqual([]);
    expect(privateTaskIds({ tasks: [{ id: 7, title: "Task", assigneeId: 2 }], sections: { General: [{ id: 7, title: "Task", assigneeId: 2 }] }, estimates: [{ taskId: 8, weekStart: "2026-11-02" }] })).toEqual([7, 8]);
    expect(personalTaskHours([{ id: 7, title: "Task", assigneeId: 3, loggedHours: 100, estimatedHours: 20 }], 2, new Map([[7, 2]]), new Map([[7, 3]]))).toEqual([{ id: 7, title: "Task", assigneeId: 3, loggedHours: 2, estimatedHours: 0 }]);
  });
});

describe("shared read cache", () => {
  it("deduplicates simultaneous work and never repopulates an invalidated cache from an older request", async () => {
    const cache = new ReadCache<number>(10_000);
    let resolve!: (value: number) => void;
    const loader = vi.fn(() => new Promise<number>(done => { resolve = done; }));
    const a = cache.get("x", loader), b = cache.get("x", loader);
    await Promise.resolve(); expect(loader).toHaveBeenCalledTimes(1);
    cache.clear(); resolve(1);
    expect(await Promise.all([a, b])).toEqual([1, 1]);
    expect(await cache.get("x", async () => 2)).toBe(2);
    expect(await cache.get("x", async () => 3)).toBe(2);
  });
  it("does not retain errors and keeps entries bounded", async () => {
    const cache = new ReadCache<number>(10_000, 1);
    await expect(cache.get("failed", async () => { throw Error("offline"); })).rejects.toThrow("offline");
    expect(await cache.get("failed", async () => 1)).toBe(1);
    await cache.get("other", async () => 2);
    expect(await cache.get("failed", async () => 3)).toBe(3);
  });
});
