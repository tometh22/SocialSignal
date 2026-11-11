import { test, expect, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

const url = process.env.E2E_DATABASE_URL || "postgres://mind_test:mind_test@127.0.0.1:5432/mind_e2e";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname) || !new URL(url).pathname.startsWith("/mind_e2e")) throw new Error("Use an isolated local browser database");
const pool = new Pool({ connectionString: url, max: 2 });
const year = new Date().getFullYear();
async function login(request: APIRequestContext, profile: string) {
  expect((await request.post("/api/login", { data: { email: `e2e-training-${profile}@example.test`, password: "mind-local-test-only" } })).ok()).toBe(true);
}
let personId: number;
let operationsId: number;
test.beforeAll(async () => {
  // Dedicated Operations identity: prove authorization without relying on admin bypass.
  const result = await pool.query(`INSERT INTO users(first_name,last_name,email,password,role,permissions)
    SELECT 'Operaciones','Feedback','e2e-training-operations@example.test',password,'member',ARRAY['operations','projects'] FROM users WHERE email='e2e-training-admin@example.test'
    ON CONFLICT(email) DO UPDATE SET permissions=EXCLUDED.permissions RETURNING id`);
  operationsId = result.rows[0].id;
  await pool.query("INSERT INTO user_notification_preferences(user_id,setup_completed_at) VALUES($1,NOW()) ON CONFLICT(user_id) DO UPDATE SET setup_completed_at=NOW()", [operationsId]);
  personId = (await pool.query("SELECT id FROM personnel WHERE email='e2e-training-member@example.test'")).rows[0].id;
  await pool.query("INSERT INTO absence_allowances(personnel_id,year,vacation_days,epical_days) VALUES($1,$2,20,3),($1,$2+1,20,3) ON CONFLICT(personnel_id,year) DO UPDATE SET vacation_days=20", [personId, year]);
});
test.beforeEach(async () => {
  await pool.query("DELETE FROM personnel_absences WHERE personnel_id=$1 AND notes='Prueba de reprogramación'", [personId]);
});
test.afterAll(async () => { await pool.end(); });
async function createAbsence(request: APIRequestContext, start: string, end = start) {
  const response = await request.post("/api/absence-requests", { data: { personnelId: personId, startDate: start, endDate: end, type: "vacation", notes: "Prueba de reprogramación" } });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}
const action = (request: APIRequestContext, id: number, data: object) => request.post(`/api/absence-requests/${id}/actions`, { data });

test("Operations can cancel approved leave with confirmation, history, notification and refreshed balance", async ({ page }) => {
  await login(page.request, "operations");
  // Find a weekday in the current year independently of the execution date.
  const date = new Date(`${year}-07-01T12:00:00Z`);
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  const day = date.toISOString().slice(0, 10);
  const absence = await createAbsence(page.request, day);
  expect((await action(page.request, absence.id, { action: "approve" })).ok()).toBe(true);
  const balanceUrl = `/api/absence-allowances/${personId}/${year}`;
  const before = await (await page.request.get(balanceUrl)).json();
  expect(before.used.vacation).toBeGreaterThan(0);
  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const capacityUrl = `/api/capacity/weekly?weekStart=${monday.toISOString().slice(0, 10)}`;
  const capacityResponse = await page.request.get(capacityUrl);
  expect(capacityResponse.status()).toBe(200);
  const capacityBefore = (await capacityResponse.json()).personnel.find((person: any) => person.personnelId === personId);
  expect(capacityBefore.absenceHours).toBeGreaterThan(0);
  await page.goto("/operations/absences");
  await page.getByRole("button", { name: "Cancelar ausencia", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Capacitación member");
  await expect(dialog).toContainText(day);
  const confirm = dialog.getByRole("button", { name: "Confirmar cancelación" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Motivo de cancelación").fill("Reprogramación: no se tomó ningún día");
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await dialog.screenshot({ path: ".context/absence-cancellation-dialog.jpg", type: "jpeg", quality: 85 });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".context/absence-cancellation-mobile.png" });
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Cancelada", { exact: true }).first()).toBeVisible();
  const after = await (await page.request.get(balanceUrl)).json();
  expect(after.used.vacation).toBe(before.used.vacation - absence.businessDays);
  const availability = await (await page.request.get(`/api/absence-requests/availability?personnelId=${personId}&from=${day}&to=${day}`)).json();
  expect(availability.unavailable).toBe(false);
  const capacityAfter = (await (await page.request.get(capacityUrl)).json()).personnel.find((person: any) => person.personnelId === personId);
  expect(capacityAfter.absenceHours).toBe(0);
  expect(capacityAfter.maxCapacity).toBe(capacityBefore.maxCapacity + capacityBefore.absenceHours);
  const saved = (await pool.query("SELECT * FROM personnel_absences WHERE id=$1", [absence.id])).rows[0];
  expect(saved.cancelled_by).toBe(operationsId);
  expect(saved.cancelled_at).toBeTruthy();
  expect(saved.cancellation_reason).toContain("Reprogramación");
  const repeat = { action: "cancel_by_operations", reason: "Reintento de red", confirmUnusedDays: true };
  expect((await action(page.request, absence.id, repeat)).ok()).toBe(true);
  expect((await pool.query("SELECT * FROM absence_events WHERE absence_id=$1 AND action='cancel_by_operations'", [absence.id])).rowCount).toBe(1);
  expect((await pool.query("SELECT * FROM user_notifications WHERE entity_id=$1 AND event_key LIKE 'absence-cancel_by_operations:%'", [absence.id])).rowCount).toBe(1);
});

test("server enforces permissions and unused-days confirmation; concurrent cross-year cancellation is safe", async ({ request, browser }) => {
  await login(request, "operations");
  const absence = await createAbsence(request, `${year}-12-28`, `${year+1}-01-05`);
  expect((await action(request, absence.id, { action: "approve" })).ok()).toBe(true);
  const payload = { action: "cancel_by_operations", reason: "No se tomará este período", confirmUnusedDays: true };
  expect((await action(request, absence.id, { ...payload, reason: "  " })).status()).toBe(400);
  expect((await action(request, absence.id, { ...payload, confirmUnusedDays: false })).status()).toBe(400);
  const other = await browser.newContext();
  try {
    await login(other.request, "member");
    expect((await action(other.request, absence.id, payload)).status()).toBe(403);
    expect((await action(other.request, absence.id, { action: "request_cancellation", reason: "Cambio de fechas" })).ok()).toBe(true);
  } finally { await other.close(); }
  const results = await Promise.all([action(request, absence.id, { ...payload, action: "approve_cancellation" }), action(request, absence.id, payload)]);
  expect(results.some(r => r.ok())).toBe(true);
  expect(results.every(r => r.ok() || r.status() === 409)).toBe(true);
  expect((await pool.query("SELECT * FROM absence_events WHERE absence_id=$1 AND to_status='cancelled'", [absence.id])).rowCount).toBe(1);
  for (const y of [year, year+1]) expect((await (await request.get(`/api/absence-allowances/${personId}/${y}`)).json()).used.vacation).toBe(0);
});


test("blocked periods reject cancellation atomically and allow it after explicit reopening", async ({ request }) => {
  await login(request, "operations");
  const absence = await createAbsence(request, `${year}-02-02`, `${year}-02-06`);
  expect((await action(request, absence.id, { action: "approve" })).ok()).toBe(true);
  const payload = { action: "cancel_by_operations", reason: "No se tomó la ausencia", confirmUnusedDays: true };
  await pool.query("INSERT INTO payroll_periods(period,state) VALUES($1,'cut') ON CONFLICT(period) DO UPDATE SET state='cut'", [`${year}-02`]);
  try {
    expect((await action(request, absence.id, payload)).status()).toBe(409);
    expect((await pool.query("SELECT status FROM personnel_absences WHERE id=$1", [absence.id])).rows[0].status).toBe("approved");
    expect((await pool.query("SELECT * FROM absence_events WHERE absence_id=$1 AND to_status='cancelled'", [absence.id])).rowCount).toBe(0);
  } finally { await pool.query("DELETE FROM payroll_periods WHERE period=$1", [`${year}-02`]); }
  expect((await action(request, absence.id, payload)).ok()).toBe(true);
});

test("commercial projects require an approved quotation; internal projects retain compatibility", async ({ request }) => {
  await login(request, "operations");
  const clientId = (await pool.query("SELECT id FROM clients ORDER BY id LIMIT 1")).rows[0].id;
  const data = { clientId, name: "Validación de alta", startDate: `${year}-11-01`, projectCategory: "billable" };
  expect((await request.post("/api/active-projects", { data })).status()).toBe(400);
  const quoteId = (await pool.query("SELECT id FROM quotations WHERE status='draft' AND archived_at IS NULL ORDER BY id LIMIT 1")).rows[0].id;
  expect((await request.post("/api/active-projects", { data: { ...data, quotationId: quoteId } })).status()).toBe(400);
  await pool.query("INSERT INTO clients(name,contact_name) SELECT 'Epical','Equipo interno' WHERE NOT EXISTS(SELECT 1 FROM clients WHERE name='Epical')");
  const internal = await request.post("/api/active-projects", { data: { ...data, projectCategory: "internal", internalType: "demo" } });
  expect(internal.status(), await internal.text()).toBe(201);
  const project = await internal.json();
  expect(project.quotationId).toBeNull();
  expect(project.projectCategory).toBe("internal");
  await pool.query("UPDATE quotations SET status='approved' WHERE id=$1", [quoteId]);
  let commercialId: number | undefined;
  try {
    const mismatched = await request.post("/api/active-projects", { data: { ...data, quotationId: quoteId, clientId: project.clientId } });
    expect(mismatched.status()).toBe(400);
    const commercial = await request.post("/api/active-projects", { data: { ...data, quotationId: quoteId } });
    expect(commercial.status(), await commercial.text()).toBe(201);
    commercialId = (await commercial.json()).id;
    expect((await request.post("/api/active-projects", { data: { ...data, quotationId: quoteId } })).status()).toBe(409);
  } finally {
    if (commercialId) await pool.query("DELETE FROM active_projects WHERE id=$1", [commercialId]);
    await pool.query("UPDATE quotations SET status='draft' WHERE id=$1", [quoteId]);
  }
  // Existing compatibility routes remain protected and reachable.
  for (const path of ["/review/objectives", "/operations/estimated-rates", "/operations/service-blueprints"]) expect((await request.get(path)).ok()).toBe(true);
});

test("retired guides disappear from navigation and search; merged guide links and unified details work", async ({ page }) => {
  await login(page.request, "admin");
  await page.goto("/training");
  await expect(page.getByRole("link", { name: "Objetivos", exact: true })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Finanzas", exact: true })).toHaveCount(0);
  for (const query of ["Objetivos", "Tarifas y servicios", "Cashflow", "Entregables, calidad"]) {
    await page.getByRole("textbox", { name: "Buscar capacitación" }).fill(query);
    await expect(page.getByText("No encontramos guías con esos filtros.")).toBeVisible();
  }
  await page.goto("/training/entregables");
  await expect(page).toHaveURL(/\/training\/cartera$/);
  await expect(page.getByRole("heading", { name: "Cartera y gestión del proyecto" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aclaraciones y situaciones frecuentes" })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Qué revisar", exact: true })).toHaveCount(0);
  await page.goto("/training/facturas-personales");
  await expect(page.getByRole("region", { name: "Paso a paso" }).getByRole("listitem")).toHaveCount(8);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".context/feedback-training-invoices-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
