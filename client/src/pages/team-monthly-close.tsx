import { useState } from "react";
import MonthlyClosing from "./monthly-closing";
import TeamSettlements from "./team-settlements";
import { Button } from "@/components/ui/button";

export default function TeamMonthlyClose() {
  const [step, setStep] = useState(() => window.location.pathname.includes("liquidaciones") ? 2 : 1);
  return <div className="space-y-5">
    <div><h1 className="text-3xl font-semibold">Cierre del equipo</h1><p className="mt-2 text-muted-foreground">Primero definís cuánto corresponde cobrar; después autorizás cómo se factura. Los colaboradores completan los tipos de cambio, extras y comprobantes en <strong>Mis facturas</strong>.</p></div>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Etapas del cierre del equipo">
      <Button role="tab" aria-selected={step === 1} variant={step === 1 ? "default" : "outline"} onClick={() => setStep(1)}>1. Base a cobrar</Button>
      <Button role="tab" aria-selected={step === 2} variant={step === 2 ? "default" : "outline"} onClick={() => setStep(2)}>2. Facturación y seguimiento</Button>
    </div>
    <p className="rounded-lg border bg-muted/30 p-3 text-sm">El <strong>cierre financiero</strong> es otro proceso: Finanzas concilia ingresos, costos, cuentas y movimientos de toda la empresa y aprueba el resultado del mes.</p>
    {step === 1 ? <MonthlyClosing /> : <TeamSettlements />}
  </div>;
}
