/** Regenerate candidate screenshots in .context; review them before copying to server/content/training-media. */
import { chromium, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { trainingLessons } from "../server/content/training-catalog";

const base = process.env.TRAINING_CAPTURE_URL || "http://127.0.0.1:55942";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname))
  throw new Error("Screenshots require a local isolated app with e2e fixtures");
const selectedIds = process.env.TRAINING_CAPTURE_LESSONS?.split(",");
const directory = ".context/training-media";
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch();
const records: object[] = [];
let failures = 0;

async function capture(page: Page, name: string, dialog = false, height = 888) {
  await page.evaluate(() => document.fonts.ready);
  const target = dialog
    ? page.getByRole("dialog")
    : page.locator("main").first();
  await target.evaluate((element) =>
    Promise.all(
      element
        .getAnimations()
        .filter(
          (animation) => animation.effect?.getTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
  const box = await target.boundingBox();
  if (!box) throw new Error(`No capture target for ${name}`);
  const clip = {
    x: box.x,
    y: Math.max(0, box.y),
    width: Math.min(box.width, 1440 - box.x),
    height: Math.min(height, box.height, 960 - Math.max(0, box.y)),
  };
  await page.screenshot({
    path: `${directory}/${name}.jpg`,
    type: "jpeg",
    quality: 85,
    animations: "disabled",
    clip,
  });
  records.push({
    fileName: `${name}.jpg`,
    width: Math.floor(clip.width),
    height: Math.floor(clip.height),
    source: new URL(page.url()).pathname,
  });
}

try {
  for (const profile of ["member", "admin", "provider"] as const) {
    const email =
      profile === "member"
        ? "e2e-1@example.test"
        : `e2e-training-${profile}@example.test`;
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
      deviceScaleFactor: 1,
      locale: "es-AR",
      timezoneId: "America/Argentina/Buenos_Aires",
    });
    const response = await context.request.post(`${base}/api/login`, {
      data: { email, password: "mind-local-test-only" },
    });
    if (!response.ok()) throw new Error(`Missing local fixture: ${email}`);
    // Only a personal training preference is written; no operational actions are submitted.
    await context.request.put(`${base}/api/training/invitation`, {
      data: { dismissed: true },
    });
    const personal = new Set([
      "bienvenida",
      "inicio",
      "notificaciones",
      "ausencias-personales",
      "facturas-personales",
      "proyectos-tareas",
      "tareas",
      "horas",
    ]);
    const page = await context.newPage();
    for (const lesson of trainingLessons.filter(
      (l) =>
        (!selectedIds || selectedIds.includes(l.id)) &&
        (profile === "provider"
          ? l.access.audience === "provider"
          : profile === "member"
            ? personal.has(l.id)
            : !personal.has(l.id) && l.access.audience !== "provider"),
    )) {
      try {
        if (profile === "member") {
          await context.request.post(`${base}/api/login`, {
            data: {
              email: lesson.id === "inicio" ? "e2e-3@example.test" : email,
              password: "mind-local-test-only",
            },
          });
          await context.request.put(`${base}/api/training/invitation`, {
            data: { dismissed: true },
          });
        }
        let destination = lesson.links[0].href;
        if (lesson.id === "capacidad-calendario")
          destination = "/tasks/team-calendar";
        if (lesson.id === "tareas") {
          const projects = await (
            await context.request.get(`${base}/api/tasks/projects`)
          ).json();
          const project = projects.find(
            (item: { name: string }) => item.name === "Proyecto compartido",
          );
          if (!project) throw new Error("Missing seeded task project");
          destination = `/tasks/projects/${project.id}`;
        }
        if (lesson.id === "propuestas") {
          const listing = await (
            await context.request.get(`${base}/api/quotations?limit=1`)
          ).json();
          const quote = listing.items?.[0];
          if (!quote) throw new Error("Missing seeded quotation");
          destination = `/quotations/${quote.id}/studio`;
        }
        await page.goto(base + destination);
        await page.waitForLoadState("networkidle");
        const main = page.locator("main").first();
        await expect(main).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "Error en la Aplicación" }),
        ).toHaveCount(0);
        await expect(
          main.getByText(/^Cargando(?:\.\.\.|…)?$/).first(),
        ).toHaveCount(0, { timeout: 20_000 });
        await expect(main.locator(".animate-spin:visible")).toHaveCount(0, {
          timeout: 20_000,
        });
        await expect(
          main.getByText(/Error al cargar|No se pudo cargar/).first(),
        ).toHaveCount(0);
        if (lesson.id === "proyectos-tareas")
          await page.getByRole("button", { name: /Cliente de prueba/ }).click();
        if (lesson.id === "personal-tarifas")
          await page
            .getByRole("tab", { name: "Personal", exact: true })
            .click();
        if (lesson.id === "configuracion-precios")
          await page
            .getByRole("tab", { name: "Tipos de Cambio", exact: true })
            .click();
        if (lesson.id === "tareas") {
          await page
            .getByText("Tarea pendiente de auditoría", { exact: true })
            .click();
          await expect(
            page.getByPlaceholder("Agregar descripción..."),
          ).toBeVisible({ timeout: 20_000 });
          await capture(page, "tareas", true);
          await page
            .getByRole("button", { name: "Registrar", exact: true })
            .click();
          await page
            .getByPlaceholder("ej: 0.25 · 1.5 · 1h30", { exact: true })
            .fill("2,5");
          await page
            .getByPlaceholder("¿En qué trabajaste? (opcional)")
            .fill("Revisión del informe de ejemplo");
          const hoursPanel = page
            .getByText(/^Tiempo registrado/)
            .locator("..")
            .locator("..");
          await hoursPanel.scrollIntoViewIfNeeded();
          await hoursPanel.screenshot({
            path: `${directory}/horas-formulario.jpg`,
            type: "jpeg",
            quality: 85,
            animations: "disabled",
          });
          const box = await hoursPanel.boundingBox();
          records.push({
            fileName: "horas-formulario.jpg",
            width: Math.floor(box!.width),
            height: Math.floor(box!.height),
            source: destination,
          });
        } else if (lesson.id === "cierre-equipo") {
          const table = page
            .getByRole("heading", { name: /^Cierre .+ 2026$/ })
            .locator("..")
            .locator("..");
          await table.screenshot({
            path: `${directory}/cierre-equipo.jpg`,
            type: "jpeg",
            quality: 85,
            animations: "disabled",
          });
          const box = await table.boundingBox();
          records.push({
            fileName: "cierre-equipo.jpg",
            width: Math.floor(box!.width),
            height: Math.floor(box!.height),
            source: destination,
          });
        } else if (lesson.id === "proveedor-horas") {
          await page
            .getByRole("button", { name: "Cargar horas", exact: true })
            .click();
          await page.getByLabel("Horas", { exact: true }).fill("3");
          await page
            .getByLabel("Descripción", { exact: true })
            .fill("Preparación del informe de ejemplo");
          // This legacy modal has no dialog role. Its form container is captured directly.
          const form = page
            .locator("div.fixed.inset-0")
            .filter({
              has: page.getByRole("button", { name: "Guardar horas" }),
            })
            .locator("div.bg-white")
            .first();
          const box = await form.boundingBox();
          if (!box) throw new Error("Provider hours form missing");
          await page.screenshot({
            path: `${directory}/proveedor-horas.jpg`,
            type: "jpeg",
            quality: 85,
            animations: "disabled",
            clip: box,
          });
          records.push({
            fileName: "proveedor-horas.jpg",
            width: Math.floor(box.width),
            height: Math.floor(box.height),
            source: destination,
          });
        } else {
          const shorter: Record<string, number> = {
            bienvenida: 240,
            "tarifas-servicios": 320,
            "proyectos-tareas": 520,
            reportes: 490,
            cashflow: 480,
            "cierre-financiero": 600,
            "facturas-equipo": 560,
            "admin-proveedores": 440,
            "proveedor-panel": 440,
          };
          await capture(page, lesson.id, false, shorter[lesson.id] ?? 888);
        }
        console.log(`Captured ${lesson.id}`);
      } catch (error) {
        failures++;
        console.error(`Skipped ${lesson.id}: ${String(error)}`);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(
    `${directory}/capture-manifest.json`,
    JSON.stringify(records, null, 2),
  );
}
if (failures) process.exitCode = 1;
