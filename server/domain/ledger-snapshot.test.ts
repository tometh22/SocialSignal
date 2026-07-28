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
    expect(parseSheetPeriod("01 ene", 2026)).toBe("2026-01");
    expect(parseSheetPeriod("15 julio", "2026")).toBe("2026-07");
    expect(parseSheetPeriod("invalid")).toBeNull();
  });

  test("parses the production Activo contract and selects only the requested month", () => {
    const values = [
      [
        "Concepto/Banco",
        "Tipo de Activo",
        "Cliente",
        "Mes",
        "Año",
        "Cobrado/No Cobrado AL CIERRE",
        "Fecha de pago/Nota de credito",
        "Vencido",
        "Fecha Facturación",
        "Nro de Factura/Comprobante",
        "Razón Social/Cliente",
        "Detalle",
        "Fecha de vencimiento",
        "Moneda original ARS",
        "Moneda original USD",
        "Cotización",
        "Monto Total USD",
      ],
      [
        "Clientes a cobrar",
        "Clientes a cobrar",
        "Acme",
        "01 jul",
        2026,
        "Cobrado",
        "",
        "A término",
        "",
        "A-1",
        "ACME SA",
        "",
        46200,
        1_500_000,
        "",
        1_250,
        1_200,
      ],
      ["Banco", "Activo Líquido", "", "01 jun", 2026, "", "", "", "", "", "", "", "", "", 100, "", 100],
    ];

    const snapshot = parseActivoSnapshot(values, "2026-07");

    expect(snapshot.rows).toHaveLength(1);
    expect(snapshot.skipped).toBe(1);
    expect(snapshot.rows[0]).toMatchObject({
      concepto: "Clientes a cobrar",
      tipoActivo: "Clientes a cobrar",
      clienteNombre: "Acme",
      montoARS: "1500000",
      montoUSD: null,
      cotizacion: "1250",
      montoTotalUSD: "1200",
      cobradoAlCierre: true,
      vencido: false,
      nroFactura: "A-1",
      razonSocial: "ACME SA",
    });
  });

  test("parses the production Pasivo contract, spreadsheet dates and negative state", () => {
    const values = [
      [
        "Detalle",
        "Subtipo de costo",
        "Mes",
        "Año",
        "Pagado/No Pagado AL CIERRE",
        "Fecha de pago",
        "Fecha emisión",
        "Concepto/Detalle",
        "Descripción/Factura",
        "Fecha de vencimiento",
        "Moneda original ARS",
        "Moneda original USD",
        "Cotización",
        "Monto Total USD",
        "Vencido",
      ],
      [
        "Proveedor Uno",
        "Equipo",
        "01 jul",
        2026,
        "No Pagado",
        "",
        46200,
        "Honorarios",
        "Factura C-1",
        46230,
        500_000,
        "",
        1_250,
        400,
        "Vencido",
      ],
    ];

    const snapshot = parsePasivoSnapshot(values, "2026-07");

    expect(snapshot.rows).toHaveLength(1);
    expect(snapshot.rows[0]).toMatchObject({
      detalle: "Proveedor Uno",
      subtipoCosto: "Equipo",
      montoARS: "500000",
      montoTotalUSD: "400",
      pagadoAlCierre: false,
      vencido: true,
      concepto: "Honorarios",
      descripcion: "Factura C-1",
    });
    expect(snapshot.rows[0].fechaEmision).toBeInstanceOf(Date);
    expect(snapshot.rows[0].fechaVencimiento).toBeInstanceOf(Date);
  });
});
