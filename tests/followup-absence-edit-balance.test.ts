import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findAllowanceShortfalls } from "../shared/utils/absence-balance";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");
const none = new Set<string>();
// Semana del 2 al 6 de marzo de 2026 = 5 días hábiles; 9 al 13 = otros 5.
const week1 = { type: "vacation", startDate: "2026-03-02", endDate: "2026-03-06" };

describe("editar una ausencia aprobada respeta el saldo (misma regla que aprobar)", () => {
  const allowances = [{ year: 2026, vacationDays: 10, vacationCarryoverDays: 2, epicalDays: 3 }];

  it("deja pasar una edición que cabe en el cupo (traslado incluido)", () => {
    expect(findAllowanceShortfalls({ type: "vacation", requestedByYear: { 2026: 12 }, allowances, otherActiveAbsences: [], holidayDates: none })).toEqual([]);
  });

  it("rechaza una edición que excede el saldo, descontando las demás ausencias aprobadas", () => {
    const result = findAllowanceShortfalls({ type: "vacation", requestedByYear: { 2026: 8 }, allowances, otherActiveAbsences: [week1], holidayDates: none });
    expect(result).toEqual([{ year: 2026, kind: "insufficient", available: 7, requested: 8 }]);
  });

  it("no cuenta dos veces la ausencia que se edita (se evalúa sin ella entre las demás)", () => {
    // 12 disponibles, 5 ya aprobadas en OTRA ausencia: la edición de 7 días cabe justo.
    expect(findAllowanceShortfalls({ type: "vacation", requestedByYear: { 2026: 7 }, allowances, otherActiveAbsences: [week1], holidayDates: none })).toEqual([]);
  });

  it("avisa cuando el año no tiene cupo configurado", () => {
    expect(findAllowanceShortfalls({ type: "vacation", requestedByYear: { 2027: 1 }, allowances, otherActiveAbsences: [], holidayDates: none }))
      .toEqual([{ year: 2027, kind: "not_configured", available: 0, requested: 1 }]);
  });

  it("valida los días Epical contra cupo − usados, sin mezclar con vacaciones", () => {
    const epicalUsed = [{ type: "epical_day", startDate: "2026-04-01", endDate: "2026-04-02" }];
    expect(findAllowanceShortfalls({ type: "epical_day", requestedByYear: { 2026: 1 }, allowances, otherActiveAbsences: [...epicalUsed, week1], holidayDates: none })).toEqual([]);
    expect(findAllowanceShortfalls({ type: "epical_day", requestedByYear: { 2026: 2 }, allowances, otherActiveAbsences: epicalUsed, holidayDates: none }))
      .toEqual([{ year: 2026, kind: "insufficient", available: 1, requested: 2 }]);
  });

  it("respeta el adelanto de años anteriores (deuda) al calcular el saldo", () => {
    const withDebt = [
      { year: 2025, vacationDays: 2, vacationCarryoverDays: 0, epicalDays: 3 },
      { year: 2026, vacationDays: 10, vacationCarryoverDays: 0, epicalDays: 3 },
    ];
    const used2025 = { type: "vacation", startDate: "2025-03-03", endDate: "2025-03-07" }; // 5 días con cupo 2 → deuda 3
    const result = findAllowanceShortfalls({ type: "vacation", requestedByYear: { 2026: 8 }, allowances: withDebt, otherActiveAbsences: [used2025], holidayDates: none });
    expect(result).toEqual([{ year: 2026, kind: "insufficient", available: 7, requested: 8 }]);
  });

  it("la ruta PATCH la aplica sólo a ausencias que ya descuentan, valida lo que empeora y bloquea los cupos", () => {
    const routes = source("server/routes.ts");
    const patch = routes.slice(routes.indexOf('app.patch("/api/absence-requests/:id"'), routes.indexOf('app.post("/api/absence-requests/:id/actions"'));
    expect(patch).toContain('["approved", "cancellation_requested"].includes(current.status)');
    expect(patch).toContain("findAllowanceShortfalls(");
    expect(patch).toContain("if (days > (previousByYear[Number(year)] ?? 0))");
    expect(patch).toContain("FOR UPDATE");
    expect(patch).toContain("status: 409");
  });
});
