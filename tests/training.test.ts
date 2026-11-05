import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  canAccessTraining,
  TRAINING_SECTIONS,
  type TrainingAudience,
} from "../shared/training";
import {
  trainingLessons,
  publicLesson,
  gradeTrainingAnswer,
} from "../server/content/training-catalog";
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
    expect(ids({ permissions: ["dashboard"] })).toContain("reportes");
    expect(ids({ permissions: ["dashboard"] })).not.toContain(
      "carga-financiera",
    );
  });
  it("has stable unique ids and usable, server-graded exercises for every lesson", () => {
    expect(new Set(trainingLessons.map((l) => l.id)).size).toBe(
      trainingLessons.length,
    );
    expect(new Set(trainingLessons.map((l) => l.module)).size).toBe(9);
    expect(new Set(trainingLessons.map((l) => l.practice.kind))).toEqual(
      new Set(["choice", "order", "form"]),
    );
    for (const lesson of trainingLessons) {
      expect(lesson.explanation.length).toBeGreaterThanOrEqual(2);
      expect(lesson.covers.length).toBeGreaterThan(0);
      for (const step of ["practice", "check"] as const) {
        expect(
          gradeTrainingAnswer(lesson, step, lesson[step].answer).correct,
        ).toBe(true);
        expect(
          gradeTrainingAnswer(lesson, step, "incorrect answer").correct,
        ).toBe(false);
        expect(publicLesson(lesson)[step]).not.toHaveProperty("answer");
        expect(publicLesson(lesson)[step]).not.toHaveProperty("feedback");
      }
    }
  });
  it("accepts decimal commas and rejects blanks, wrong ordering, duplicated steps and malformed payloads", () => {
    const hours = trainingLessons.find((l) => l.id === "horas")!;
    expect(
      gradeTrainingAnswer(hours, "practice", {
        hours: "2,5",
        date: "2026-11-12",
      }).correct,
    ).toBe(true);
    expect(
      gradeTrainingAnswer(hours, "practice", { hours: "", date: "2026-11-12" })
        .correct,
    ).toBe(false);
    const ordering = trainingLessons.find((l) => l.id === "crm")!;
    expect(
      gradeTrainingAnswer(ordering, "practice", ["item-0", "item-0", "item-2"])
        .correct,
    ).toBe(false);
    expect(
      trainingSubmissionSchema.safeParse({ version: 1, step: "check" }).success,
    ).toBe(false);
    expect(
      trainingSubmissionSchema.safeParse({
        version: 1,
        step: "learn",
        userId: 22,
      }).success,
    ).toBe(false);
    expect(
      trainingSubmissionSchema.safeParse({
        version: 1,
        step: "learn",
        completed: true,
      }).success,
    ).toBe(false);
    expect(
      trainingSubmissionSchema.safeParse({
        version: 1,
        step: "practice",
        answer: "x".repeat(1001),
      }).success,
    ).toBe(false);
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
    const covered = new Set(trainingLessons.flatMap((l) => l.covers));
    expect(
      patterns.filter((path) => !covered.has(path) && !exclusions.has(path)),
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
