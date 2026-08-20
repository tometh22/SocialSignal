import { Plus, ReceiptText, Trash2 } from "lucide-react";
import { useOptimizedQuote } from "@/context/optimized-quote-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function CommercialTermsCard() {
  const { quotationData, updateQuotationData } = useOptimizedQuote();
  const schedule = quotationData.paymentSchedule || [];
  const scheduleTotal = schedule.reduce((sum, milestone) => sum + Number(milestone.percentage || 0), 0);
  const updateMilestone = (index: number, changes: Partial<(typeof schedule)[number]>) => {
    updateQuotationData({
      paymentSchedule: schedule.map((milestone, position) => position === index ? { ...milestone, ...changes } : milestone),
    });
  };

  return (
    <Card className="border-slate-200 shadow-sm lg:col-span-2 xl:col-span-3">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <ReceiptText className="h-4 w-4 text-indigo-600" /> Condiciones comerciales y legales
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>Tipo de contratación</Label>
            <Select value={quotationData.quotationType || 'one-time'} onValueChange={(value) => updateQuotationData({ quotationType: value as 'one-time' | 'recurring' | 'fee' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="one-time">Proyecto único</SelectItem>
                <SelectItem value="recurring">Servicio recurrente</SelectItem>
                <SelectItem value="fee">Fee mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quotation-expiry">Válida hasta</Label>
            <Input id="quotation-expiry" type="date" value={quotationData.expiresAt || ''} onChange={(event) => updateQuotationData({ expiresAt: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-terms">Plazo de pago</Label>
            <div className="relative">
              <Input id="payment-terms" type="number" min={0} max={730} value={quotationData.paymentTermsDays ?? ''} onChange={(event) => updateQuotationData({ paymentTermsDays: event.target.value === '' ? null : Number(event.target.value) })} className="pr-14" />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400">días</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="terms-version">Versión de términos</Label>
            <Input id="terms-version" value={quotationData.termsVersion || '1'} onChange={(event) => updateQuotationData({ termsVersion: event.target.value })} />
          </div>
        </div>

        <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="tax-label">Impuesto</Label>
            <Input id="tax-label" value={quotationData.taxLabel || 'IVA'} onChange={(event) => updateQuotationData({ taxLabel: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax-rate">Tasa (%)</Label>
            <Input id="tax-rate" type="number" min={0} max={100} step="0.01" value={quotationData.taxRate ?? 0} onChange={(event) => updateQuotationData({ taxRate: Number(event.target.value) })} />
          </div>
          <div className="flex items-end">
            <label className="flex h-10 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-sm">
              Precio informado incluye impuesto
              <Switch checked={quotationData.pricesIncludeTax || false} onCheckedChange={(checked) => updateQuotationData({ pricesIncludeTax: checked })} />
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Label>Cronograma de pagos</Label>
              <p className={`text-xs ${schedule.length > 0 && Math.abs(scheduleTotal - 100) > 0.01 ? 'text-red-600' : 'text-slate-500'}`}>
                {schedule.length === 0 ? 'Sin hitos: aplica el plazo general.' : `Distribución actual: ${scheduleTotal.toFixed(2)}% de 100%.`}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => updateQuotationData({ paymentSchedule: [...schedule, { label: `Hito ${schedule.length + 1}`, percentage: 0, dueDays: quotationData.paymentTermsDays ?? 0 }] })}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Agregar hito
            </Button>
          </div>
          {schedule.map((milestone, index) => (
            <div key={`${milestone.label}-${index}`} className="grid gap-2 md:grid-cols-[1fr_120px_140px_40px]">
              <Input aria-label={`Nombre del hito ${index + 1}`} value={milestone.label} onChange={(event) => updateMilestone(index, { label: event.target.value })} />
              <Input aria-label={`Porcentaje del hito ${index + 1}`} type="number" min={0.01} max={100} step="0.01" value={milestone.percentage} onChange={(event) => updateMilestone(index, { percentage: Number(event.target.value) })} />
              <Input aria-label={`Días del hito ${index + 1}`} type="number" min={0} max={730} value={milestone.dueDays ?? ''} onChange={(event) => updateMilestone(index, { dueDays: event.target.value === '' ? undefined : Number(event.target.value) })} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Eliminar hito ${index + 1}`} onClick={() => updateQuotationData({ paymentSchedule: schedule.filter((_, position) => position !== index) })}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2"><Label htmlFor="quote-inclusions">Incluye</Label><Textarea id="quote-inclusions" rows={4} value={quotationData.inclusions || ''} onChange={(event) => updateQuotationData({ inclusions: event.target.value })} placeholder="Entregables, rondas de revisión y soporte incluidos." /></div>
          <div className="space-y-2"><Label htmlFor="quote-exclusions">No incluye</Label><Textarea id="quote-exclusions" rows={4} value={quotationData.exclusions || ''} onChange={(event) => updateQuotationData({ exclusions: event.target.value })} placeholder="Pauta, traducciones, viajes u otros conceptos excluidos." /></div>
          <div className="space-y-2"><Label htmlFor="commercial-terms">Términos comerciales</Label><Textarea id="commercial-terms" rows={4} value={quotationData.commercialTerms || ''} onChange={(event) => updateQuotationData({ commercialTerms: event.target.value })} placeholder="Vigencia, propiedad intelectual, confidencialidad y reajustes." /></div>
        </div>
        {(quotationData.financials.priceMode === 'manual' || Number(quotationData.financials.discountPercentage || 0) > 0) && (
          <div className="space-y-2">
            <Label htmlFor="adjustment-reason">Justificación del precio o descuento</Label>
            <Textarea id="adjustment-reason" rows={3} value={quotationData.adjustmentReason || ''} onChange={(event) => updateQuotationData({ adjustmentReason: event.target.value })} placeholder="Motivo comercial verificable para que la persona aprobadora pueda evaluar la excepción." />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
