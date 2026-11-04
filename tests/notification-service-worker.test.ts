import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  readPushDeviceToken,
  isPushEndpoint,
} from "../server/services/notification-device";

async function receivePush(account: number | null) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const showNotification = vi.fn(async () => undefined);
  const fetch = vi.fn(async () => ({
    ok: account !== null,
    json: async () => ({ id: account }),
  }));
  vm.runInNewContext(readFileSync("client/public/service-worker.js", "utf8"), {
    self: {
      addEventListener: (name: string, handler: (event: unknown) => void) => {
        listeners[name] = handler;
      },
      registration: { showNotification },
    },
    fetch,
    AbortSignal,
  });
  let work: Promise<void> = Promise.resolve();
  listeners.push({
    data: {
      json: () => ({
        userId: 1,
        title: "Privado",
        body: "Detalle del proyecto",
      }),
    },
    waitUntil: (promise: Promise<void>) => {
      work = promise;
    },
  });
  await work;
  return { showNotification, fetch };
}
describe("notification device privacy", () => {
  it("does not display queued personal pushes after logout or an account switch", async () => {
    expect((await receivePush(null)).showNotification).not.toHaveBeenCalled();
    expect((await receivePush(2)).showNotification).not.toHaveBeenCalled();
    expect((await receivePush(1)).showNotification).toHaveBeenCalledWith(
      "Privado",
      expect.objectContaining({ body: "Detalle del proyecto" }),
    );
  });
  it("recognizes device cookies without a cookie-parser middleware", () => {
    const token = "a".repeat(64);
    expect(
      readPushDeviceToken(`other=value; mind_push_device=${token}; extra=1`),
    ).toBe(token);
    expect(readPushDeviceToken("mind_push_device=invalid")).toBeNull();
    expect(readPushDeviceToken()).toBeNull();
  });
  it("accepts browser push providers and rejects arbitrary network targets", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/test",
      "https://updates.push.services.mozilla.com/wpush/v2/test",
      "https://web.push.apple.com/test",
      "https://wns2.notify.windows.com/test",
    ])
      expect(isPushEndpoint(endpoint)).toBe(true);
    for (const endpoint of [
      "https://127.0.0.1/private",
      "https://fcm.googleapis.com.evil.test",
      "https://user:password@fcm.googleapis.com/test",
      "http://fcm.googleapis.com/test",
    ])
      expect(isPushEndpoint(endpoint)).toBe(false);
  });
});
