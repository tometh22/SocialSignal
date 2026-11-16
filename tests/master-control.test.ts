import { describe, expect, it } from "vitest";
import { controlCheck } from "../shared/master-control";
import { masterDetailTotals } from "../server/domain/master-control-totals";

describe("control mensual Máster–Mind", () => {
  const base = { id: "x", kind: "sync" as const, label: "x", hint: "", expectedLabel: "", actualLabel: "" };
  it("coincide dentro de un dólar y marca diferencias mayores", () => {
    expect(controlCheck({ ...base, expectedUsd: 100.004, actualUsd: 100.9 }).ok).toBe(true);
    expect(controlCheck({ ...base, expectedUsd: 102370.17, actualUsd: 147346.21 })).toMatchObject({ ok: false, differenceUsd: 44976.04 });
  });
  it("un mes sin datos en ambos lados no es una diferencia", () => {
    expect(controlCheck({ ...base, expectedUsd: null, actualUsd: 0 }).ok).toBe(true);
    expect(controlCheck({ ...base, expectedUsd: null, actualUsd: 50 }).ok).toBe(false);
  });
  it("separa facturas, bancos y cripto, y quita impuestos de EE. UU. y provisiones de proveedores", () => {
    const activo = [["h"], ["Santander", "Activo Liquido", "", "10 oct", 2026, "", "", "", "", "", "", "", "", "", "", "", 500], ["Cripto", "Mediano Plazo", "", "10 oct", 2026, "", "", "", "", "", "", "", "", "", "", "", 70],
      ["Fee", "Clientes a cobrar", "Warner", "10 oct", 2026, "No", "", "", "", "", "", "", "", "", "", "", 1000], ["Fee", "Clientes a cobrar", "Animal", "10 oct", 2026, "Si", "", "", "", "", "", "", "", "", "", "", 300]];
    const pasivo = [["h"], ["Equipo", "Equipo", "10 oct", 2026, "No Pagado", "", "", "", "", "", "", "", "", 200], ["IRS", "Impuestos USA", "10 oct", 2026, "No Pagado", "", "", "", "", "", "", "", "", 90], ["Prov", "Provisión Pasivo", "10 oct", 2026, "No Pagado", "", "", "", "", "", "", "", "", 40], ["Board", "Board", "10 oct", 2026, "Pagado", "", "", "", "", "", "", "", "", 60]];
    const totals = masterDetailTotals({ activo, pasivo, cash: [["Ingreso/Egreso"]] }, "2026-10");
    expect(totals).toMatchObject({ bank: 500, receivables: 1300, receivablesPending: 1000, payables: 390, payablesPending: 330, payablesPendingOperating: 200 });
  });
});
