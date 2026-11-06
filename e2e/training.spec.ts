import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, profile = "member") {
  expect(
    (
      await page.request.post("/api/login", {
        data: {
          email: `e2e-training-${profile}@example.test`,
          password: "mind-local-test-only",
        },
      })
    ).ok(),
  ).toBeTruthy();
}

test("reference guides: invitation, search, immediate instructions and optional reading across sessions", async ({
  page,
  browser,
}) => {
  await signIn(page);
  await page.goto("/");
  const invitation = page.getByRole("complementary", {
    name: "Invitación a capacitación",
  });
  await expect(invitation).toBeVisible();
  await expect(invitation).toContainText("Instrucciones paso a paso");
  await page
    .getByRole("button", { name: "Descartar invitación a capacitación" })
    .click();
  await expect(invitation).toHaveCount(0);
  await page.reload();
  await expect(invitation).toHaveCount(0);
  await page
    .getByRole("link", { name: "Ayuda y capacitación", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Capacitación", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Resumen financiero y reportes",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Buscar capacitación" })
    .fill("horas");
  await expect(
    page.getByRole("heading", {
      name: "Registrar y revisar horas",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Conocer Mind", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("textbox", { name: "Buscar capacitación" }).fill("");
  await page.screenshot({
    path: ".context/training-guides-desktop.png",
    fullPage: true,
  });
  await page.goto("/training/bienvenida");
  await expect(
    page.getByRole("heading", { name: "Paso a paso", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Paso a paso" }).getByRole("listitem"),
  ).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Comprobar respuesta" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Marcar como leída" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Guía marcada como leída",
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Guía leída" })).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Paso a paso", exact: true }),
  ).toBeVisible();
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await signIn(other);
    await other.goto("/training/bienvenida");
    await expect(
      other.getByRole("button", { name: "Guía leída" }),
    ).toBeDisabled();
  } finally {
    await context.close();
  }
});

test("consulting instructions needs no writes and failed read markers never block work", async ({
  page,
}) => {
  await signIn(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method()) &&
      request.url().includes("/api/")
    )
      writes.push(new URL(request.url()).pathname);
  });
  await page.goto("/training/horas");
  await expect(
    page.getByRole("region", { name: "Paso a paso" }).getByRole("listitem"),
  ).toHaveCount(5);
  await expect(
    page.getByRole("link", { name: "Abrir Panel de horas" }),
  ).toBeVisible();
  expect(writes).toEqual([]);
  await page.screenshot({
    path: ".context/training-guide-desktop.png",
    fullPage: true,
  });
  await page.route(
    "**/api/training/lessons/horas/progress",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"message":"Error temporal de prueba"}',
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Marcar como leída" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "No se pudo guardar la marca de lectura",
  );
  await page.getByRole("link", { name: "Abrir Panel de horas" }).click();
  await expect(page).toHaveURL(/\/tasks\/hours-dashboard$/);
  await page.goto("/training/horas");
  await page.getByRole("button", { name: "Marcar como leída" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Guía marcada como leída",
  );
  expect(
    writes.every((path) => path === "/api/training/lessons/horas/progress"),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("link", { name: "Todas las guías" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: ".context/training-guide-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (await page.request.get("/api/training/lessons/reportes")).status(),
  ).toBe(404);
  await page.goto("/training/reportes");
  await expect(
    page.getByRole("heading", { name: "Guía no disponible" }),
  ).toBeVisible();
});

test("provider has relevant procedures and keyboard access without exercises", async ({
  page,
}) => {
  await signIn(page, "provider");
  await page.goto("/training");
  for (const name of ["Mi panel de proveedor", "Cargar horas como proveedor"])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  for (const name of ["CRM", "Registrar y revisar horas"])
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(
      0,
    );
  const guideLink = page.getByRole("link", {
    name: /Mis facturas de proveedor/,
  });
  await guideLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/training\/proveedor-facturas$/);
  await expect(
    page.getByRole("heading", { name: "Paso a paso", exact: true }),
  ).toBeVisible();
  const details = page.locator("summary");
  await details.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(
      "Consultá el estado de la factura y los motivos de devolución.",
      { exact: false },
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Todas las guías" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".context/training-provider-guides-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("admin can find instructions by area and clear search filters", async ({
  page,
}) => {
  await signIn(page, "admin");
  await page.goto("/training");
  for (const name of [
    "Cargar datos",
    "Cartera de proyectos",
    "Personal, roles y tarifas",
  ])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Filtrar por área" })
    .selectOption("Finanzas");
  await expect(
    page.getByRole("heading", { name: "Cargar datos", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Personal, roles y tarifas",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Buscar capacitación" })
    .fill("nada-coincide");
  await expect(
    page.getByText("No encontramos guías con esos filtros."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Personal, roles y tarifas",
      exact: true,
    }),
  ).toBeVisible();
});

test("background failures preserve pending reading recovery; explicit revocation hides cached instructions", async ({
  page,
}) => {
  await page.clock.install();
  await signIn(page);
  await page.goto("/training/tareas");
  const saveFailure = (route: import("@playwright/test").Route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"message":"Error temporal"}',
    });
  await page.route("**/api/training/lessons/tareas/progress", saveFailure);
  await page.getByRole("button", { name: "Marcar como leída" }).click();
  await expect(
    page.getByRole("button", { name: "Reintentar guardado" }),
  ).toBeVisible();
  await page.route("**/api/training", saveFailure);
  const refreshed = page.waitForResponse(
    (r) => r.url().endsWith("/api/training") && r.status() === 503,
  );
  await page.clock.runFor(61_000);
  await refreshed;
  await page.clock.runFor(2_000);
  await expect(
    page.getByRole("button", { name: "Reintentar actualización" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reintentar guardado" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Paso a paso", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/training", saveFailure);
  await page.getByRole("button", { name: "Reintentar actualización" }).click();
  await expect(
    page.getByRole("button", { name: "Reintentar actualización" }),
  ).toHaveCount(0);
  await page.route("**/api/training/lessons/tareas", saveFailure);
  const focused = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/training/lessons/tareas") && r.status() === 503,
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await focused;
  await page.clock.runFor(2_000);
  await expect(
    page.getByRole("button", { name: "Reintentar actualización" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reintentar guardado" }),
  ).toBeVisible();
  await page.unroute("**/api/training/lessons/tareas", saveFailure);
  await page.route("**/api/training/lessons/tareas", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: '{"message":"Guía no disponible"}',
    }),
  );
  const rejected = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/training/lessons/tareas") && r.status() === 404,
  );
  await page.getByRole("button", { name: "Reintentar actualización" }).click();
  await rejected;
  await page.clock.runFor(2_000);
  await expect(
    page.getByRole("heading", { name: "Paso a paso", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("No pudimos cargar la guía.", { exact: false }),
  ).toBeVisible();
});

test("real screenshots can be opened with the keyboard and zoomed on mobile", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/training/horas");
  const reference = page.getByRole("region", { name: "Referencia visual" });
  const thumbnail = reference.getByRole("img");
  await expect(thumbnail).toBeVisible();
  await expect(thumbnail).toHaveJSProperty("naturalWidth", 535);
  const enlarge = reference.getByRole("button", { name: /^Ampliar captura:/ });
  await enlarge.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("img", {
      name: "Formulario de registro de horas en una tarea",
      exact: true,
    }),
  ).toHaveJSProperty("complete", true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(enlarge).toBeFocused();
  await reference.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: ".context/training-with-screenshot-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await enlarge.click();
  await dialog.getByRole("button", { name: "Ver tamaño original" }).click();
  await expect(
    dialog.getByRole("button", { name: "Ajustar a la pantalla" }),
  ).toHaveAttribute("aria-pressed", "true");
  const viewer = dialog.getByRole("region", { name: "Captura ampliada" });
  expect(
    await viewer.evaluate((node) => node.scrollWidth > node.clientWidth),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await dialog.getByRole("button", { name: "Ajustar a la pantalla" }).click();
  await page.screenshot({
    path: ".context/training-screenshot-mobile.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Abrir Tareas", exact: true }),
  ).toBeEnabled();
});

test("a failed screenshot can retry without hiding instructions or blocking navigation", async ({
  page,
}) => {
  await signIn(page);
  await page.route(
    "**/api/training/lessons/horas/media/referencia",
    (route) => route.fulfill({ status: 503, body: "Temporary test failure" }),
    { times: 1 },
  );
  await page.goto("/training/horas");
  const reference = page.getByRole("region", { name: "Referencia visual" });
  await reference.scrollIntoViewIfNeeded();
  await expect(reference.getByRole("status")).toContainText(
    "No pudimos cargar la captura",
  );
  await expect(
    page.getByRole("heading", { name: "Paso a paso", exact: true }),
  ).toBeVisible();
  await reference.getByRole("button", { name: "Reintentar imagen" }).click();
  await expect(reference.getByRole("img")).toHaveJSProperty(
    "naturalWidth",
    535,
  );
  await page.getByRole("link", { name: "Todas las guías" }).click();
  await expect(page).toHaveURL(/\/training$/);
});
