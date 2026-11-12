import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import {
  canAccessTraining,
  TRAINING_SECTIONS,
  type TrainingAudience,
} from "../shared/training";
import {
  trainingLessons,
  archivedTrainingLessons,
  publicLesson,
} from "../server/content/training-catalog";
import { trainingScreenshots } from "../server/content/training-media";
import { trainingSubmissionSchema } from "../server/routes-training";
import { trainingMigrationSql } from "../server/migrations/training";

const visible = (user: TrainingAudience) =>
  trainingLessons.filter((l) => canAccessTraining(user, l.access));
const ids = (user: TrainingAudience) => visible(user).map((l) => l.id);

describe("training access and curriculum", () => {
  it("combines permissions without duplicate lessons, preserves task-only privacy and distinguishes portfolio access", () => {
    expect(ids({ permissions: ["task_manager"] })).toContain("horas");
    expect(ids({ permissions: ["task_manager"] })).not.toContain("reportes");
    expect(ids({ permissions: ["projects"] })).not.toContain("cartera");
    expect(ids({ permissions: ["operations"] })).not.toContain("cartera");
    expect(ids({ permissions: ["projects", "operations"] })).toContain(
      "cartera",
    );
    const combined = ids({
      permissions: ["crm", "operations", "task_manager"],
    });
    expect(combined).toEqual(
      expect.arrayContaining(["crm", "horas", "cierre-equipo"]),
    );
    expect(new Set(combined).size).toBe(combined.length);
    expect(ids({ permissions: [] })).toEqual([
      "bienvenida",
      "notificaciones",
      "facturas-personales",
    ]);
    expect(ids({ role: "manager", permissions: [] })).not.toContain(
      "cierre-equipo",
    );
    expect(
      trainingLessons.every((l) => !canAccessTraining(null, l.access)),
    ).toBe(true);
  });
  it("supports legacy and role admins, and isolates providers even with accidental internal permissions", () => {
    expect(ids({ isAdmin: true })).toEqual(ids({ role: "admin" }));
    expect(ids({ isAdmin: true })).toContain("personal-tarifas");
    const provider = {
      role: "external_provider",
      isAdmin: true,
      permissions: [...TRAINING_SECTIONS],
    };
    expect(ids(provider)).toEqual([
      "bienvenida",
      "notificaciones",
      "proveedor-panel",
      "proveedor-facturas",
    ]);
    expect(ids({ ...provider, providerCanLogHours: true })).toContain(
      "proveedor-horas",
    );
    expect(ids({ permissions: ["dashboard"] })).not.toContain("reportes");
    expect(ids({ permissions: ["dashboard"] })).not.toContain(
      "carga-financiera",
    );
  });
  it("provides complete reference instructions for every area without assessments", () => {
    expect(new Set(trainingLessons.map((l) => l.id)).size).toBe(
      trainingLessons.length,
    );
    expect(new Set(trainingLessons.map((l) => l.module)).size).toBe(8);
    for (const lesson of trainingLessons) {
      expect(lesson.version).toBe(3);
      expect(lesson.instructions.length).toBeGreaterThanOrEqual(3);
      expect(lesson.instructions.every((step) => step.length > 30)).toBe(true);
      expect(lesson.verification.length).toBeGreaterThan(20);
      expect(lesson.explanation.length).toBeGreaterThanOrEqual(2);
      expect(lesson.covers.length).toBeGreaterThan(0);
      expect(publicLesson(lesson)).not.toHaveProperty("practice");
      expect(publicLesson(lesson)).not.toHaveProperty("check");
      expect(lesson.minutes).toBeGreaterThan(0);
    }
  });
  it("accepts only a personal read marker and rejects quiz or forged completion payloads", () => {
    expect(
      trainingSubmissionSchema.safeParse({ version: 2, step: "learn" }).success,
    ).toBe(true);
    for (const payload of [
      { version: 2, step: "check" },
      { version: 2, step: "practice", answer: "x" },
      { version: 2, step: "learn", userId: 22 },
      { version: 2, step: "learn", completed: true },
      { version: 2, step: "learn", answer: "x" },
    ])
      expect(trainingSubmissionSchema.safeParse(payload).success).toBe(false);
  });
  it("ships real private screenshots for every guide, tied to an existing instruction", () => {
    expect(Object.keys(trainingScreenshots).sort()).toEqual(
      [...trainingLessons, ...archivedTrainingLessons].map((lesson) => lesson.id).sort(),
    );
    for (const lesson of trainingLessons) {
      const media = publicLesson(lesson).screenshots;
      expect(media.length).toBeGreaterThan(0);
      for (const [index, screenshot] of media.entries()) {
        expect(screenshot.src).toBe(
          `/api/training/lessons/${lesson.id}/media/${screenshot.id}`,
        );
        expect(screenshot.step).toBeGreaterThan(0);
        expect(screenshot.step).toBeLessThanOrEqual(lesson.instructions.length);
        expect(screenshot.alt.length).toBeGreaterThan(10);
        expect(screenshot.caption.length).toBeGreaterThan(30);
        expect(screenshot.width).toBeGreaterThan(300);
        expect(screenshot.height).toBeGreaterThan(100);
        const authored = trainingScreenshots[lesson.id][index];
        expect(authored.fileName).toMatch(/^[a-z0-9-]+\.jpg$/);
        const file = `server/content/training-media/${authored.fileName}`;
        expect(readFileSync(file).subarray(0, 3)).toEqual(
          Buffer.from([0xff, 0xd8, 0xff]),
        );
        expect(statSync(file).size).toBeLessThan(250_000);
        expect(
          existsSync(`client/public/training-media/${authored.fileName}`),
        ).toBe(false);
        expect(screenshot).not.toHaveProperty("fileName");
      }
    }
  });
  it("maps current feature routes to lessons; excludes only aliases and technical/demo routes", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");
    const patterns = [...app.matchAll(/<ProtectedRoute path="([^"]+)"[^\n]+/g)]
      .filter((match) => !match[0].includes("<Redirect"))
      .map((match) => match[1]);
    const exclusions = new Set([
      "/active-projects-next",
      "/quote-redirect",
      "/projects/:id",
      "/project-details/:id",
      "/project/:id",
      "/currency-demo",
    ]);
    // Retired surfaces retain legacy routes; they are intentionally not advertised.
    const deferred = new Set(archivedTrainingLessons.flatMap(l => l.covers));
    const covered = new Set(trainingLessons.flatMap((l) => l.covers));
    expect(
      patterns.filter((path) => !covered.has(path) && !exclusions.has(path) && !deferred.has(path)),
    ).toEqual([]);
    // Every link is a real route and does not depend on a fabricated record id.
    for (const lesson of trainingLessons)
      for (const link of lesson.links) {
        expect(patterns).toContain(link.href);
        expect(link.href).not.toContain(":");
      }
  });
  it("keeps startup and manual migration equivalent", () => {
    expect(readFileSync("migrations/0094_training.sql", "utf8").trim()).toBe(
      trainingMigrationSql.trim(),
    );
  });
});
