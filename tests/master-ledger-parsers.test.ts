import { describe, expect, it } from "vitest";
import { parseCashflowSnapshot, parseProvisionMatrix, provisionMatrixColumns } from "../server/domain/ledger-snapshot";

const serial = (iso: string) => (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;
const cashHeader = ["Ingreso/Egreso", "Banco", "Moneda", "Fecha", "Mes", "Año", "Cliente", "Detalle Operación", "Concepto", "Monto ARS", "Cotización", "Monto original USD", "Monto USD", "Saldo Santander", "Saldo BOA", "Saldo CAJA", "Saldo Total USD"];

describe("CashFlow del Máster", () => {
  const rows = [
    cashHeader,
    ["Saldo", "Santander", "ARS", serial("2026-08-01"), "08 ago", 2026, "", "Saldo inicial", "", 5365042, 1180, "", 4546.64],
    ["Egreso", "Santander", "ARS", serial("2026-08-04"), "08 ago", 2026, "", "XAVIER RICARDO ARANZANA", "Honorarios", 1_200_000, 1545, "", 776.7],
    ["Ingreso", "Bank Of America", "USD", serial("2026-08-12"), "08 ago", 2026, "Warner", "Cobro FC A-0001", "Fee", "", "", 13450, 13450],
    ["Egreso", "Santander", "ARS", serial("2026-09-02"), "09 sep", 2026, "", "Otro mes", "", 100000, 1560, "", 64.1],
    ["Egreso", "Santander", "ARS", serial("2026-08-20"), "08 ago", 2026, "", "Sin importe", "", "", "", "", ""],
  ];

  it("toma la fecha real, excluye saldos y usa el monto USD convertido", () => {
    const result = parseCashflowSnapshot(rows, "2026-08");
    expect(result.rows).toHaveLength(2);
    const [egreso, ingreso] = result.rows;
    expect(egreso).toMatchObject({ tipoMovimiento: "Egreso", banco: "Santander", montoUSD: "776.7", montoARS: "1200000", cotizacion: "1545", detalleOperacion: "XAVIER RICARDO ARANZANA" });
    // A day above 12 must not be read as a month (the old importer moved it to another month).
    expect(ingreso.fecha.toISOString()).toBe("2026-08-12T12:00:00.000Z");
    expect(ingreso).toMatchObject({ tipoMovimiento: "Ingreso", montoUSD: "13450", clienteNombre: "Warner" });
    expect(result.skipped).toBe(3);
  });
});

describe("Provisión pasivo del Máster", () => {
  // Same layout as the real tab: first month column is September of the first year.
  const header = ["", "Criterios", "Facturación", "Provisión inicial", "Sep", "Oct", "Nov", "Dic", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const matrix = [
    ["Nota de cálculo"],
    header,
    ["Warner Insights 25/26", "Primer pago", 60640, 15687, -383, -810.84, -798.16, 0, 0, -1177, -1658],
    ["", "Segundo pago", 20320, 5230, "", "", "", "", "", 5230],
    ["", "Tercer pago", 11550, 2590, "", "", "", "", "", "", 2590, -1345.64, -1884.81, -2378.39, -587.61, -343.12, "", -775.96],
    ["PepsiCo", "Proyecto cerrado", 35550, "", "", 13413, -1474.19, -1448.53, -1680.72, -1491.25, -1442.3, -5876.01],
    ["Provisión Bonos a pagar en Enero", "Baja con el cierre de enero", "", "", "", "", "", 18000, -18000],
    ["Warner Insights 26/27", "Primer pago", 45480, "", "", "", "", "", "", "", "", "", "", "", "", "", "", 11703],
    ["", "Segundo pago"],
  ];
  const resumen = new Map<string, number | null>([
    ["2025-09", 0], ["2025-10", 27906], ["2025-11", 25633.65], ["2025-12", 42185.12], ["2026-10", 23066.6], ["2026-12", null],
  ]);

  it("ubica los meses en la secuencia de años", () => {
    const columns = provisionMatrixColumns(header, 2025);
    expect(columns[0]).toEqual({ index: 4, periodKey: "2025-09" });
    expect(columns.at(-1)).toEqual({ index: 19, periodKey: "2026-12" });
  });

  it("reproduce los saldos del Resumen y elige el año que los concilia", () => {
    const result = parseProvisionMatrix(matrix, resumen, { candidateYears: [2024, 2025, 2026] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.startYear).toBe(2025);
    const total = (period: string) => result.rows.get(period)!.reduce((sum, row) => sum + row.balanceUsd, 0);
    expect(total("2025-10")).toBeCloseTo(27906.16, 2);
    expect(total("2026-10")).toBeCloseTo(23067.47, 2);
    expect(result.rows.get("2026-10")!.map(row => row.clienteNombre)).toContain("Warner Insights 26/27");
    // Without a provision in the Resumen the month is imported empty instead of inventing a balance.
    expect(result.rows.get("2025-09")).toEqual([]);
    expect(result.mismatched).toEqual([]);
  });

  it("reporta los meses que no concilian en lugar de importarlos", () => {
    const result = parseProvisionMatrix(matrix, new Map([...resumen, ["2025-11", 30000]]), { candidateYears: [2025] });
    expect(result.ok && result.mismatched.map(row => row.periodKey)).toEqual(["2025-11"]);
    expect(result.ok && result.rows.has("2025-11")).toBe(false);
  });
});
