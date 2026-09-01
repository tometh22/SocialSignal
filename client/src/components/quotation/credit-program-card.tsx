import { useMemo, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { calculateCreditProgramTotals, createDefaultCreditProgram, type CreditProgram } from '@shared/utils/credit-program';
import { CalendarDays, Coins, Info, ShieldCheck } from 'lucide-react';

function asNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function CreditProgramCard() {
  const { quotationData, updateQuotationData } = useOptimizedQuote();
  const program = quotationData.creditProgram || createDefaultCreditProgram();
  const totals = useMemo(() => calculateCreditProgramTotals(program), [program]);
  const defaultPackagePrice = totals.totalCredits * Number(program.executiveCreditValueUSD || 0);

  const update = (patch: Partial<CreditProgram>) => {
    updateQuotationData({ creditProgram: { ...program, ...patch, enabled: true } });
  };

  const updateCredits = (value: string) => {
    const totalCredits = Math.max(1, Math.floor(asNumber(value, program.totalCredits)));
    const wasDefault = Math.abs(Number(program.packagePriceUSD || 0) - (program.totalCredits * Number(program.executiveCreditValueUSD || 0))) < 0.01;
    update({ totalCredits, packagePriceUSD: wasDefault ? totalCredits * Number(program.executiveCreditValueUSD || 0) : program.packagePriceUSD });
  };

  const updateExecutiveValue = (value: string) => {
    const executiveCreditValueUSD = asNumber(value, program.executiveCreditValueUSD);
    const wasDefault = Math.abs(Number(program.packagePriceUSD || 0) - defaultPackagePrice) < 0.01;
    update({ executiveCreditValueUSD, packagePriceUSD: wasDefault ? totals.totalCredits * executiveCreditValueUSD : program.packagePriceUSD });
  };

  return (
    <Card className="border-indigo-200 bg-indigo-50/30 shadow-none">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base text-slate-950"><Coins className="h-4 w-4 text-indigo-600" /> Bolsa de créditos</CardTitle>
            <p className="mt-1 text-sm text-slate-600">El cliente compra la capacidad por adelantado y consume informes según sus prioridades durante la vigencia.</p>
          </div>
          <Badge className="w-fit bg-indigo-100 text-indigo-800 hover:bg-indigo-100">Pago anticipado</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CreditField id="credit-total" label="Créditos de la bolsa" hint="Ej. 47">
            <Input id="credit-total" type="number" min={1} step={1} value={program.totalCredits} onChange={(event) => updateCredits(event.target.value)} />
          </CreditField>
          <CreditField id="credit-package-price" label="Precio total de bolsa (USD)" hint="Se cotiza en USD y se convierte a ARS si corresponde">
            <Input id="credit-package-price" type="number" min={1} step={100} value={program.packagePriceUSD} onChange={(event) => update({ packagePriceUSD: Math.max(0, asNumber(event.target.value)) })} />
          </CreditField>
          <CreditField id="credit-validity-start" label="Inicio de vigencia">
            <Input id="credit-validity-start" type="date" value={program.validityStart} onChange={(event) => update({ validityStart: event.target.value })} />
          </CreditField>
          <CreditField id="credit-validity-end" label="Fin de vigencia">
            <Input id="credit-validity-end" type="date" value={program.validityEnd} onChange={(event) => update({ validityEnd: event.target.value })} />
          </CreditField>
        </div>

        <div className="grid gap-4 rounded-xl border border-indigo-100 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <CreditField id="credit-executive-value" label="Informe ejecutivo · 1 crédito" hint="USD 500 a USD 1.900">
            <Input id="credit-executive-value" type="number" min={500} max={1900} step={50} value={program.executiveCreditValueUSD} onChange={(event) => updateExecutiveValue(event.target.value)} />
          </CreditField>
          <CreditField id="credit-deep-value" label="Estudio en profundidad · 3 créditos" hint="USD 1.500 a USD 5.800">
            <Input id="credit-deep-value" type="number" min={1500} max={5800} step={100} value={program.deepStudyCreditValueUSD} onChange={(event) => update({ deepStudyCreditValueUSD: asNumber(event.target.value) })} />
          </CreditField>
          <CreditField id="credit-carryover" label="Carry-over máximo" hint="Tope comercial: 20%">
            <Input id="credit-carryover" type="number" min={0} max={20} step={1} value={program.carryoverPercentage} onChange={(event) => update({ carryoverPercentage: asNumber(event.target.value) })} />
          </CreditField>
          <CreditField id="credit-grace" label="Ventana de gracia (meses)" hint="Hasta 4 meses">
            <Input id="credit-grace" type="number" min={0} max={4} step={1} value={program.graceMonths} onChange={(event) => update({ graceMonths: asNumber(event.target.value) })} />
          </CreditField>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <Checkbox id="credit-active-fee" checked={program.hasActiveFee} onCheckedChange={(checked) => update({ hasActiveFee: checked === true })} />
          <div>
            <Label htmlFor="credit-active-fee" className="cursor-pointer text-sm font-medium text-slate-800">El cliente tiene fee o plataforma activa</Label>
            <p className="mt-1 text-xs leading-5 text-slate-500">Con fee activo aplican los valores preferenciales y el stack/seteo queda incluido; sin fee, el setup inicial se cotiza aparte.</p>
          </div>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <CreditStat icon={Coins} label="Saldo contratado" value={`${totals.totalCredits} créditos`} />
          <CreditStat icon={ShieldCheck} label="Carry-over disponible" value={`${totals.carryoverCredits} créditos`} />
          <CreditStat icon={CalendarDays} label="Gracia posterior" value={`${totals.graceMonths} meses`} />
        </div>
        <p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />Consumo orientativo: un informe ejecutivo utiliza 1 crédito; un Landscape o seguimiento extendido utiliza 3 créditos. Los sobrantes expiran al finalizar la ventana de gracia.</p>
      </CardContent>
    </Card>
  );
}

function CreditField({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id} className="text-xs font-semibold text-slate-700">{label}</Label>{children}{hint && <p className="text-[11px] leading-4 text-slate-500">{hint}</p>}</div>;
}

function CreditStat({ icon: Icon, label, value }: { icon: typeof Coins; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-lg bg-indigo-50 px-3 py-2.5"><Icon className="h-4 w-4 text-indigo-600" /><div><p className="text-[11px] text-slate-500">{label}</p><p className="font-semibold text-slate-900">{value}</p></div></div>;
}
