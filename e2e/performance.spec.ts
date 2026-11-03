import { WebSocket } from "ws";
import { expect, test, type Page, type APIRequestContext } from "@playwright/test";

async function signIn(request: APIRequestContext, index: number) {
  const response = await request.post("/api/login", { data: { email: `e2e-${index}@example.test`, password: "mind-local-test-only" } });
  expect(response.ok()).toBeTruthy();
}

test("a member sees personal tasks, preserves privacy and never requests the operations-only calendar", async ({ page, request }) => {
  request = page.request;
  await signIn(request, 1);
  const forbidden: string[] = [];
  page.on("response", response => { if (response.status() === 403 && response.url().includes("team-calendar")) forbidden.push(response.url()); });
  await page.goto("/");
  await expect(page.getByTestId("home-today")).toContainText("Tarea de prueba");
  expect(forbidden).toEqual([]);
  const own = await request.get("/api/tasks/my-tasks?limit=30");
  const first = await own.json();
  expect(first.tasks).toHaveLength(30);
  expect(first.counts.in_progress).toBe(140);
  expect(first.tasks.every((task: any) => !task.asanaSource?.raw && !task.asanaSource?.csvRaw)).toBeTruthy();
  const next = await (await request.get(`/api/tasks/my-tasks?limit=30&beforeId=${first.nextCursor}`)).json();
  expect(next.tasks).toHaveLength(30);
  expect(next.tasks.some((row: any) => first.tasks.some((item: any) => item.id === row.id))).toBeFalsy();
  const task = await (await request.get("/api/tasks/1")).json();
  expect(task.loggedHours).toBe(2);
  const search = await (await request.get("/api/search?q=privado")).json();
  expect(search.some((result: any) => result.title === "Proyecto privado")).toBeFalsy();
  await page.screenshot({ path: ".context/audit-performance/home-member-after.png", fullPage: true });
});

test("BI and diagnostics reject anonymous users and members, allow finance/admin", async ({ request }) => {
  expect((await request.get("/api/bi/pnl-mensual")).status()).toBe(401);
  await signIn(request, 1);
  expect((await request.get("/api/bi/pnl-mensual")).status()).toBe(403);
  expect((await request.get("/api/admin/performance")).status()).toBe(403);
  await signIn(request, 0);
  expect((await request.get("/api/bi/pnl-mensual")).status()).toBe(200);
  expect((await request.get("/api/admin/performance")).status()).toBe(200);
});

test("CRM uses bounded pages with correct last activity and reminder count", async ({ request, page }) => {
  request = page.request;
  await signIn(request, 0);
  const first = await (await request.get("/api/crm/leads?limit=50")).json();
  expect(first.items).toHaveLength(50);
  expect(first.items.every((lead: any) => lead.lastActivity.content === "Última" && lead.pendingReminders === 1)).toBeTruthy();
  const second = await (await request.get(`/api/crm/leads?limit=50&beforeId=${first.nextCursor}`)).json();
  expect(second.items).toHaveLength(50);
  expect(new Set([...first.items, ...second.items].map(row => row.id)).size).toBe(100);
  const calls: string[] = [];
  await page.goto("/crm");
  await expect(page.getByLabel("Buscar empresa o contacto")).toBeVisible();
  page.on("request", request => { if (request.url().includes("/api/crm/leads?")) calls.push(request.url()); });
  await page.getByLabel("Buscar empresa o contacto").fill("Oportunidad 119");
  await expect.poll(() => calls.filter(url => url.includes("search=")).length).toBe(1);
  await expect(page.getByText("Oportunidad 119", { exact: true }).first()).toBeVisible();
});

test("financial intake responds with a queued draft and malformed pagination is rejected", async ({ request }) => {
  await signIn(request, 0);
  const response = await request.post("/api/financial-native/intake/text", { data: { text: "Factura cliente USD 123 del 03/11/2026" } });
  expect(response.status()).toBe(202);
  expect((await response.json()).status).toBe("received");
  expect((await request.get("/api/tasks/my-tasks?limit=99999")).status()).toBe(400);
  expect((await request.get("/api/quotations?limit=-1")).status()).toBe(400);
  expect((await request.get("/api/crm/leads?limit=bad")).status()).toBe(400);
});

test("mobile navigation and explicit task errors remain usable", async ({ page, request }) => {
  request = page.request;
  await signIn(request, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/tasks/my-tasks?*", route => route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"Simulated failure"}' }));
  await page.goto("/tasks/my-tasks");
  await expect(page.getByRole("alert")).toContainText("No se pudieron cargar tus tareas");
  await expect(page.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: ".context/audit-performance/tasks-mobile-error-after.png", fullPage: true });
});


test("quotation totals cover every page and archived rows remain excluded", async ({ request }) => {
  await signIn(request, 0);
  const first = await (await request.get("/api/quotations?limit=50")).json();
  const stats = await (await request.get("/api/quotations/stats?fallbackFx=1000")).json();
  expect(first.items).toHaveLength(50);
  expect(stats.total).toBe(79);
  expect(stats.totalValueARS).toBe(79 * 150);
  expect(stats.totalValueUSD).toBeCloseTo(79 * .15);
  const second = await (await request.get(`/api/quotations?limit=50&beforeId=${first.nextCursor}`)).json();
  expect(second.items).toHaveLength(29);
  expect(second.nextCursor).toBeNull();
  expect([...first.items, ...second.items].some(row => row.archivedAt)).toBeFalsy();
});

test("file intake persists the original and returns without waiting for extraction", async ({ request }) => {
  await signIn(request, 0);
  const text = `Factura de prueba USD 100 ${Date.now()}`;
  const response = await request.post("/api/financial-native/intake/files", {
    multipart: { files: { name: "documento.txt", mimeType: "text/plain", buffer: Buffer.from(text) } },
  });
  expect(response.status()).toBe(202);
  const item = (await response.json()).items[0];
  expect(item.status).toBe("received");
  expect(item.fileAvailable).toBe(true);
  expect(item.storageKey).toBeUndefined();
  const original = await request.get(`/api/financial-native/intake/${item.id}/file`);
  expect(await original.text()).toBe(text);
  await signIn(request, 1);
  expect((await request.get(`/api/financial-native/intake/${item.id}/file`)).status()).toBe(403);
});

const secondURL = process.env.E2E_SECOND_URL || (!process.env.E2E_URL ? "http://127.0.0.1:55943" : undefined);
function waitMessage(socket: WebSocket, predicate: (data: any) => boolean) {
  return new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off("message", listener); reject(Error("WebSocket event timed out")); }, 10_000);
    const listener = (bytes: Buffer) => { const data = JSON.parse(bytes.toString()); if (predicate(data)) { clearTimeout(timeout); socket.off("message", listener); resolve(data); } };
    socket.on("message", listener);
  });
}

test("chat reaches a participant connected to another server replica", async ({ request, baseURL }) => {
  test.skip(!secondURL, "Start a second isolated API replica to exercise PostgreSQL notifications");
  const aLogin = await request.post("/api/login", { data: { email: "e2e-1@example.test", password: "mind-local-test-only" } });
  const aCookie = aLogin.headers()["set-cookie"].split(";", 1)[0];
  const bLogin = await request.post(`${secondURL}/api/login`, { data: { email: "e2e-2@example.test", password: "mind-local-test-only" } });
  const bCookie = bLogin.headers()["set-cookie"].split(";", 1)[0];
  const a = new WebSocket(baseURL!.replace("http", "ws") + "/ws", "epical-chat", { headers: { Cookie: aCookie } });
  const b = new WebSocket(secondURL!.replace("http", "ws") + "/ws", "epical-chat", { headers: { Cookie: bCookie } });
  try {
    await Promise.all([waitMessage(a, data => data.type === "connected"), waitMessage(b, data => data.type === "connected")]);
    const created = waitMessage(a, data => data.type === "conversation_created");
    const recipient = waitMessage(b, data => data.type === "conversation_updated");
    a.send(JSON.stringify({ type: "create_conversation", receiverId: 3, title: "Prueba entre réplicas" }));
    const [conversation] = await Promise.all([created, recipient]);
    const conversationId = conversation.conversation.id;
    const received = waitMessage(b, data => data.type === "conversation_updated" && data.conversationId === conversationId);
    const sent = waitMessage(a, data => data.type === "message_sent");
    const text = `Mensaje de prueba ${Date.now()}`;
    a.send(JSON.stringify({ type: "new_message", conversationId, message: text }));
    await Promise.all([received, sent]);
    const response = await request.get(`${secondURL}/api/conversations/${conversationId}`);
    expect((await response.json()).messages.some((message: any) => message.content === text)).toBeTruthy();
  } finally { a.close(); b.close(); }
});


test("delegated tasks paginate independently and keep counts for every filter", async ({ request }) => {
  await signIn(request, 1);
  const response = await request.get("/api/tasks/my-tasks?scope=delegated&status=active&limit=5");
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.tasks).toEqual([]);
  expect(result.delegatedTasks.map((row: any) => row.title)).toEqual(["Delegada bloqueada"]);
  expect(result.counts).toMatchObject({ active: 1, blocked: 1, done: 1 });
});
