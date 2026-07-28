import { describe, expect, test } from "vitest";
import {
  parseActivoSnapshot,
  parsePasivoSnapshot,
  parseSheetPeriod,
} from "./ledger-snapshot";

describe("ledger snapshots", () => {
  test("assigns undated Activo rows only to the requested current snapshot", () => {
    const values = [
      ["Concepto", "Cliente", "Monto ARS", "Cotización", "Factura"],
      ["Servicio mensual", "Acme", "1.234,56", "1.000,00", "A-1"],
    ];
    const snapshot = parseActivoSnapshot(values, "2026-07");

    expect(snapshot.rows).toHaveLength(1);
    expect(snapshot.rows[0]).toMatchObject({
      periodKey: "2026-07",
      montoARS: "1234.56",
      cotizacion: "1000",
      montoTotalUSD: "1.2345599999999999",
    });
    expect(snapshot.rows[0].sourceRowKey).toMatch(/^[a-f0-9]{32}:1$/);
  });

  test("skips explicit rows from another period or with an invalid explicit period", () => {
    const values = [
      ["Detalle", "Monto USD", "Fecha emisión"],
      ["Proveedor junio", "100", "2026-06-15"],
      ["Fecha inválida", "200", "no-es-fecha"],
      ["Proveedor julio", "300", "2026-07-03"],
    ];
    const snapshot = parsePasivoSnapshot(values, "2026-07");

    expect(snapshot.rows.map((row) => row.detalle)).toEqual(["Proveedor julio"]);
    expect(snapshot.skipped).toBe(2);
  });

  test("is deterministic and retains legitimate repeated source rows by occurrence", () => {
    const values = [
      ["Detalle", "Subtipo", "Monto USD"],
      ["Licencia", "Herramientas", "10"],
      ["Licencia", "Herramientas", "10"],
    ];
    const first = parsePasivoSnapshot(values, "2026-07");
    const second = parsePasivoSnapshot(values, "2026-07");

    expect(first.rows).toHaveLength(2);
    expect(first.rows.map((row) => row.sourceRowKey)).toEqual(
      second.rows.map((row) => row.sourceRowKey),
    );
    expect(first.rows[0].sourceRowKey).toMatch(/:1$/);
    expect(first.rows[1].sourceRowKey).toMatch(/:2$/);
  });

  test("parses civil periods without UTC month drift", () => {
    expect(parseSheetPeriod("17/07/2026")).toBe("2026-07");
    expect(parseSheetPeriod("2026-01-01")).toBe("2026-01");
    expect(parseSheetPeriod("invalid")).toBeNull();
  });
});
