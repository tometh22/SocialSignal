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

test("personal learning: invitation, search, feedback, completion and another session", async ({
  page,
  browser,
}) => {
  await signIn(page);
  await page.goto("/");
  const invitation = page.getByRole("complementary", {
    name: "Invitación a capacitación",
  });
  // The seed creates a fresh account; dismiss persists across subsequent visits.
  await expect(invitation).toBeVisible();
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
    path: ".context/training-catalog-desktop.png",
    fullPage: true,
  });
  await page.goto("/training/bienvenida");
  await page
    .getByRole("button", { name: "Guardar explicación como leída" })
    .click();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await page.getByLabel("Crear registros reales para probar").check();
  await page.getByRole("button", { name: "Comprobar respuesta" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Podés intentarlo nuevamente",
  );
  await page.getByLabel("Buscarla en Capacitación").check();
  await page.getByRole("button", { name: "Comprobar respuesta" }).click();
  await expect(page.getByRole("status")).toContainText("Avance guardado");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Comprobá", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Tus respuestas y avance personal").check();
  await page.getByRole("button", { name: "Comprobar respuesta" }).click();
  await expect(
    page.getByRole("heading", { name: "Lección completada" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Repetir lección" }).click();
  await expect(
    page.getByRole("heading", { name: "Lección completada" }),
  ).toBeVisible();
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await signIn(other);
    const result = await (
      await other.request.get("/api/training/lessons/bienvenida")
    ).json();
    expect(result.progress.completedAt).toBeTruthy();
    await other.goto("/training");
    await expect(
      other.getByText("1 /", { exact: false }).first(),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("practice forms recover failed saves and never write operational data", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/training/horas");
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method()) &&
      /\/api\/(?:tasks|provider|me\/invoices|active-projects|finance|financial|time-entries)/.test(
        request.url(),
      )
    )
      writes.push(request.url());
  });
  await page
    .getByRole("button", { name: "Guardar explicación como leída" })
    .click();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await page.getByLabel("Horas trabajadas").fill("2,5");
  await page.getByLabel("Fecha", { exact: true }).fill("2026-11-12");
  await page.route(
    "**/api/training/lessons/horas/progress",
    async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Error temporal de prueba" }),
      });
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Comprobar respuesta" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "No se pudo guardar tu avance",
  );
  await expect(page.getByLabel("Horas trabajadas")).toHaveValue("2,5");
  await page.getByRole("button", { name: "Reintentar guardado" }).click();
  await expect(page.getByRole("status")).toContainText("Avance guardado");
  expect(writes).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: ".context/training-practice-mobile.png",
    fullPage: true,
  });
  expect(
    (await page.request.get("/api/training/lessons/reportes")).status(),
  ).toBe(404);
  await page.goto("/training/reportes");
  await expect(
    page.getByRole("heading", { name: "Lección no disponible" }),
  ).toBeVisible();
});

test("provider gets its own curriculum and can order steps with the keyboard", async ({
  page,
}) => {
  await signIn(page, "provider");
  await page.goto("/training");
  await expect(
    page.getByRole("heading", { name: "Mi panel de proveedor", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Cargar horas como proveedor",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "CRM", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Registrar y revisar horas",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto("/training/proveedor-facturas");
  await page
    .getByRole("button", { name: "Guardar explicación como leída" })
    .click();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  const lastUp = page.getByRole("button", { name: "Subir paso 3" });
  await lastUp.focus();
  await page.keyboard.press("Enter");
  const secondUp = page.getByRole("button", { name: "Subir paso 2" });
  await secondUp.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Comprobar respuesta" }).click();
  await expect(page.getByRole("status")).toContainText("Avance guardado");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/training");
  await page.screenshot({
    path: ".context/training-provider-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("admin sees the internal curriculum including finance, operations and configuration", async ({
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
    page.getByText("No encontramos lecciones con esos filtros."),
  ).toBeVisible();
});
