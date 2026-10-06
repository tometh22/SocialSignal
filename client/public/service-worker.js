self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = typeof payload.title === "string" ? payload.title : "Tenés una novedad en Mind";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "Abrí Mind para ver los detalles.",
    icon: "/epical-logo.svg",
    badge: "/epical-logo.svg",
    tag: typeof payload.tag === "string" ? payload.tag : "mind-notification",
    data: { url: typeof payload.url === "string" ? payload.url : "/notifications" },
    renotify: payload.renotify === true,
  };
  const testId = typeof payload.testId === "string" ? payload.testId : null;
  event.waitUntil((async () => {
    try {
      await self.registration.showNotification(title, options);
      if (testId) {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clients) client.postMessage({ type: "mind-push-test-result", testId, shown: true });
      }
    } catch (error) {
      if (testId) {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clients) client.postMessage({ type: "mind-push-test-result", testId, shown: false });
      }
      throw error;
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/notifications", self.location.origin);
  const safePath = target.origin === self.location.origin ? `${target.pathname}${target.search}${target.hash}` : "/notifications";
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      await client.focus();
      if ("navigate" in client) await client.navigate(safePath);
      return;
    }
    await self.clients.openWindow(safePath);
  })());
});
