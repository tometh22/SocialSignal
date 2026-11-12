import { expect, test } from "@playwright/test";

const token = "a".repeat(64);
test("an invitation works without login, validates confirmation and keeps the token out of API URLs", async ({ page }) => {
  const urls: string[] = [];
  let submitted: any;
  await page.route("**/api/current-user", route => route.fulfill({ status: 401, json: { message: "No autenticado" } }));
  await page.route("**/api/account-links/validate", route => route.fulfill({ json: { email: "vicky@example.test", firstName: "Vicky" } }));
  await page.route("**/api/account-links/complete", route => { submitted = route.request().postDataJSON(); return route.fulfill({ json: { message: "Contraseña guardada" } }); });
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) urls.push(request.url()); });
  await page.goto(`/accept-invitation#token=${token}`);
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida a Mind" })).toBeVisible();
  await expect(page.getByText("vicky@example.test", { exact: true })).toBeVisible();
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("una-contraseña-larga");
  await page.getByLabel("Repetí la contraseña").fill("otra-contraseña-larga");
  await page.getByRole("button", { name: "Guardar mi contraseña" }).click();
  await expect(page.getByRole("alert")).toContainText("Las contraseñas no coinciden");
  expect(submitted).toBeUndefined();
  await page.getByLabel("Repetí la contraseña").fill("una-contraseña-larga");
  await page.screenshot({ path: ".context/account-invitation-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: ".context/account-invitation-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Guardar mi contraseña" }).click();
  await expect(page.getByRole("heading", { name: "Tu contraseña está lista" })).toBeVisible();
  expect(submitted).toEqual({ token, purpose: "invitation", password: "una-contraseña-larga", confirmPassword: "una-contraseña-larga" });
  expect(page.url()).not.toContain(token);
  expect(urls.every(url => !url.includes(token))).toBeTruthy();
});

test("mobile expired links offer recovery and the login page links to it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/current-user", route => route.fulfill({ status: 401, json: {} }));
  await page.route("**/api/account-links/validate", route => route.fulfill({ status: 400, json: { message: "El enlace venció, ya fue utilizado o fue reemplazado. Pedí uno nuevo." } }));
  let requested: any;
  await page.route("**/api/forgot-password", route => { requested = route.request().postDataJSON(); return route.fulfill({ json: { message: "Si el correo existe, recibirás un enlace." } }); });
  await page.goto(`/accept-invitation#token=${token}`);
  await expect(page.getByRole("alert")).toContainText("El enlace venció");
  await expect(page.getByLabel("Nueva contraseña", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Solicitar un nuevo enlace" }).click();
  await page.getByLabel("Email de trabajo").fill("vicky@example.test");
  await page.getByRole("button", { name: "Enviar enlace de recuperación" }).click();
  await expect(page.getByRole("heading", { name: "Revisá tu correo" })).toBeVisible();
  expect(requested).toEqual({ email: "vicky@example.test" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: ".context/account-recovery-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Volver a ingresar" }).click();
  await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
  await expect(page.getByRole("heading", { name: "Recuperá tu acceso" })).toBeVisible();
});

test("administrators create users without a password and can see and retry an unconfirmed invitation", async ({ page }) => {
  const admin = { id: 1, firstName: "Admin", lastName: "Prueba", email: "admin@example.test", isAdmin: true, isActive: true, permissions: [] };
  const newUser = { id: 2, firstName: "Vicky", lastName: "Prueba", email: "vicky@example.test", isAdmin: false, isActive: true, permissions: ["status"], invitation: { status: "failed" } };
  let created: any;
  let sent = false;
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/current-user") return route.fulfill({ json: admin });
    if (path === "/api/admin/users" && route.request().method() === "POST") {
      created = route.request().postDataJSON(); return route.fulfill({ status: 201, json: newUser });
    }
    if (path === "/api/admin/users") return route.fulfill({ json: created ? [admin, { ...newUser, invitation: { status: sent ? "pending" : "failed" } }] : [admin] });
    if (path === "/api/admin/users/2/invitation") { sent = true; return route.fulfill({ json: { sent: true } }); }
    if (path === "/api/training") return route.fulfill({ json: { audience: { isAdmin: true, permissions: [] }, lessons: [], invitationDismissed: true } });
    if (path === "/api/notifications/preferences") return route.fulfill({ json: { setupRequired: false } });
    return route.fulfill({ json: [] });
  });
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Nuevo usuario" }).click();
  await expect(page.getByText("Le enviaremos una invitación por mail", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveCount(0);
  await page.getByLabel("Nombre", { exact: true }).fill("Vicky");
  await page.getByLabel("Apellido", { exact: true }).fill("Prueba");
  await page.getByLabel("Email", { exact: true }).fill("vicky@example.test");
  await page.getByRole("button", { name: "Crear y enviar invitación" }).click();
  await expect(page.getByText("Envío no confirmado", { exact: true })).toBeVisible();
  expect(created.password).toBeUndefined();
  await page.getByRole("button", { name: "Enviar invitación a vicky@example.test" }).click();
  await expect(page.getByText("Enviada · pendiente", { exact: true })).toBeVisible();
  expect(sent).toBeTruthy();
  await page.screenshot({ path: ".context/account-invitations-admin.png", fullPage: true });
});
