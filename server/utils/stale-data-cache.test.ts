import { describe, expect, test, vi } from "vitest";
import { StaleDataCache } from "./stale-data-cache";

describe("StaleDataCache", () => {
  test("coalesces concurrent cold requests into one load", async () => {
    let release!: (value: string) => void;
    const loader = vi.fn(() => new Promise<string>((resolve) => { release = resolve; }));
    const cache = new StaleDataCache(loader, 300, 1000);

    const first = cache.get();
    const second = cache.get();
    expect(loader).toHaveBeenCalledTimes(1);
    release("snapshot");

    await expect(first).resolves.toMatchObject({ data: "snapshot", stale: false });
    await expect(second).resolves.toMatchObject({ data: "snapshot", stale: false });
  });

  test("serves stale data immediately and keeps it when refresh fails", async () => {
    let now = 0;
    const loader = vi.fn()
      .mockResolvedValueOnce("healthy")
      .mockRejectedValue(new Error("Sheets unavailable"));
    const onBackgroundError = vi.fn();
    const cache = new StaleDataCache(loader, 300, 1000, () => now, onBackgroundError);

    await expect(cache.get()).resolves.toMatchObject({ data: "healthy", stale: false });
    now = 301;
    await expect(cache.get()).resolves.toMatchObject({ data: "healthy", stale: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onBackgroundError).toHaveBeenCalledTimes(1);

    now = 302;
    await expect(cache.get()).resolves.toMatchObject({ data: "healthy", stale: true });
  });
});
