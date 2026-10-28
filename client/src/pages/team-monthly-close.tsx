import { useEffect, useState } from "react";
import MonthlyClosing from "./monthly-closing";
import TeamSettlements from "./team-settlements";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TeamMonthlyClose() {
  const [step, setStep] = useState(() => window.location.pathname.includes("liquidaciones") ? "invoices" : "base");
  const [period, setPeriod] = useState(() => {
    const saved = new URLSearchParams(window.location.search).get("period");
    const now = new Date();
    return saved && /^\d{4}-(0[1-9]|1[0-2])$/.test(saved) ? saved : `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  });
  const [baseDirty, setBaseDirty] = useState(false);
  const [invoicesDirty, setInvoicesDirty] = useState(false);
  const [nextPeriod, setNextPeriod] = useState<string | null>(null);
  const changePeriod = (value: string) => { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value === period) return; if (baseDirty || invoicesDirty) setNextPeriod(value); else setPeriod(value); };
  useEffect(() => {
    const url = new URL(window.location.href);
    url.pathname = step === "base" ? "/operations/monthly-closing" : "/operations/liquidaciones-equipo";
    url.searchParams.set("period", period);
    window.history.replaceState(window.history.state, "", url);
  }, [period, step]);
  return <div className="mx-auto max-w-7xl min-w-0 space-y-5">
    <AlertDialog open={nextPeriod != null} onOpenChange={open => { if (!open) setNextPeriod(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Tenés cambios sin guardar</AlertDialogTitle><AlertDialogDescription>Si cambiás de mes se descartarán los descuentos o condiciones que todavía no guardaste. Podés volver y guardarlos primero.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Seguir editando</AlertDialogCancel><AlertDialogAction onClick={() => { if (nextPeriod) setPeriod(nextPeriod); setBaseDirty(false); setInvoicesDirty(false); setNextPeriod(null); }}>Descartar y cambiar mes</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-semibold sm:text-3xl">Cierre del equipo</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Prepará la base a cobrar y autorizá la facturación. Cada colaborador completa TC, extras y comprobantes en <strong>Mis facturas</strong>.</p></div>
      <div className="w-full shrink-0 sm:w-48"><Label htmlFor="team-close-period">Mes trabajado</Label><Input id="team-close-period" className="mt-1.5" type="month" value={period} onChange={e => changePeriod(e.target.value)} /></div>
    </div>
    <Tabs value={step} onValueChange={setStep} className="min-w-0 space-y-5">
      <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit" aria-label="Etapas del cierre del equipo">
        <TabsTrigger value="base" className="min-h-11 whitespace-normal text-center">1. Base a cobrar</TabsTrigger>
        <TabsTrigger value="invoices" className="min-h-11 whitespace-normal text-center">2. Facturación y seguimiento</TabsTrigger>
      </TabsList>
      <TabsContent value="base" forceMount hidden={step !== "base"}><MonthlyClosing key={period} period={period} onDirtyChange={setBaseDirty} /></TabsContent>
      <TabsContent value="invoices" forceMount hidden={step !== "invoices"}><TeamSettlements key={period} period={period} onDirtyChange={setInvoicesDirty} onGoToBase={() => setStep("base")} /></TabsContent>
    </Tabs>
    <details className="rounded-lg border bg-muted/30 p-3 text-sm"><summary className="cursor-pointer font-medium">¿En qué se diferencia del cierre financiero?</summary><p className="mt-2 text-muted-foreground">El cierre del equipo prepara la remuneración y sus facturas. En el <strong>cierre financiero</strong>, Finanzas concilia ingresos, costos, cuentas y movimientos de toda la empresa y aprueba el resultado del mes.</p></details>
  </div>;
}
