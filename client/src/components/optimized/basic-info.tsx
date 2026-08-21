import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Calendar, DollarSign, FolderOpen, RefreshCw, User } from 'lucide-react';
import { Client, ClientBillingEntity, projectDurationOptions } from '@shared/schema';
import { parseLocalizedDecimal } from '@shared/utils/quotation-pricing';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { useCurrency } from '@/hooks/use-currency';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

type LiveBlueVerification = {
  status: 'matched' | 'stale-source' | 'discrepancy' | 'partial';
  differencePercentage: number | null;
  recommended: { source: string; buy: number; sell: number; updatedAt: string | null };
  sources: {
    dolarApi: { sell: number; updatedAt: string | null; ageHours: number } | null;
    dolarHoy: { sell: number; updatedAt: string | null; ageHours: number } | null;
  };
};

type ExchangeRateForecast = {
  rate: number;
  year: number;
  month: number;
  source: string | null;
  notes: string | null;
  updatedAt: string | null;
};

type OptimizedBasicInfoProps = {
  errors?: Record<string, string>;
  mode?: 'project' | 'financial';
};

const OptimizedBasicInfo: React.FC<OptimizedBasicInfoProps> = ({ errors = {}, mode = 'project' }) => {
  const {
    quotationData,
    updateClient,
    updateProjectName,
    updateProjectType,
    updateProjectDuration,
    updateQuotationCurrency,
    updateQuotationData,
  } = useOptimizedQuote();
  const isProjectMode = mode === 'project';
  const [exchangeRateInput, setExchangeRateInput] = React.useState(
    quotationData.exchangeRateSnapshot ? String(quotationData.exchangeRateSnapshot) : '',
  );
  const [pendingCurrency, setPendingCurrency] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (quotationData.exchangeRateSnapshot && document.activeElement?.id !== 'quotation-exchange-rate') {
      setExchangeRateInput(String(quotationData.exchangeRateSnapshot));
    }
  }, [quotationData.exchangeRateSnapshot]);
  const parsedExchangeRate = parseLocalizedDecimal(exchangeRateInput);
  const {
    exchangeRate: configuredExchangeRate,
    exchangeRateLoading,
    exchangeRateError,
    exchangeRateReady,
    exchangeRateSource,
    exchangeRateUpdatedAt,
  } = useCurrency();
  const {
    data: liveBlue,
    isFetching: isCheckingLiveBlue,
    refetch: checkLiveBlue,
    isError: liveBlueError,
  } = useQuery<LiveBlueVerification>({
    queryKey: ['/api/exchange-rate/live'],
    enabled: false,
    staleTime: 0,
  });
  const formatRate = (value: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value);
  const formatRateDate = (value: string | null) => value
    ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : 'sin fecha informada';
  const projectStartParts = quotationData.inflation.projectStartDate
    ? quotationData.inflation.projectStartDate.split('-').map(Number)
    : null;
  const forecastYear = projectStartParts?.[0] || 0;
  const forecastMonth = projectStartParts?.[1] || 0;
  const { data: projectFxForecast } = useQuery<ExchangeRateForecast>({
    queryKey: [`/api/exchange-rate/forecast?year=${forecastYear}&month=${forecastMonth}`],
    enabled: !isProjectMode && forecastYear > 0 && forecastMonth >= 1 && forecastMonth <= 12,
    retry: false,
  });

  const { data: clients, isLoading: isLoadingClients, isError: clientsError, refetch: refetchClients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    enabled: isProjectMode,
  });
  const { data: billingEntities = [], isLoading: billingEntitiesLoading, isError: billingEntitiesError, refetch: refetchBillingEntities } = useQuery<ClientBillingEntity[]>({
    queryKey: [`/api/clients/${quotationData.client?.id || 0}/billing-entities`],
    enabled: isProjectMode && Boolean(quotationData.client?.id),
  });
  React.useEffect(() => {
    if (!isProjectMode || !quotationData.client || quotationData.billingEntityId || billingEntities.length === 0) return;
    const preferred = billingEntities.find((entity) => entity.isDefault) || billingEntities[0];
    updateQuotationData({ billingEntityId: preferred.id });
  }, [billingEntities, isProjectMode, quotationData.billingEntityId, quotationData.client, updateQuotationData]);

  const { data: projectTypes, isLoading: isLoadingProjectTypes, isError: projectTypesError, refetch: refetchProjectTypes } = useQuery<{value: string; label: string}[]>({
    queryKey: ['/api/options/project-types'],
    enabled: isProjectMode,
  });

  const durationOptions = quotationData.project.type && quotationData.project.type in projectDurationOptions
    ? projectDurationOptions[quotationData.project.type as keyof typeof projectDurationOptions]
    : [];
  const visibleDurationOptions = quotationData.project.duration && !durationOptions.some((option) => option.value === quotationData.project.duration)
    ? [{ value: quotationData.project.duration, label: quotationData.project.duration }, ...durationOptions]
    : durationOptions;

  if (isProjectMode) {
    return (
      <div className="space-y-4">
        {(clientsError || projectTypesError) && (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>No pudimos cargar {clientsError && projectTypesError ? 'clientes ni modalidades' : clientsError ? 'los clientes' : 'las modalidades de proyecto'}.</span></div>
            <Button type="button" size="sm" variant="outline" onClick={() => { void refetchClients(); void refetchProjectTypes(); }}><RefreshCw className="mr-2 h-4 w-4" /> Reintentar</Button>
          </div>
        )}
        <Card className="border-slate-200 shadow-none">
          <CardContent className="p-5 sm:p-6">
            <div className="mb-5">
              <h3 className="text-base font-semibold text-slate-950">Datos esenciales</h3>
              <p className="mt-1 text-sm text-slate-500">Sólo lo necesario para identificar la oportunidad. Moneda y precio se definen en Finanzas.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Cliente" icon={User} required error={errors.client} errorId="client-error">
                <Select value={quotationData.client ? String(quotationData.client.id) : ''} onValueChange={(value) => { const selectedClient = clients?.find((client) => client.id === Number(value)); updateClient(selectedClient || null); updateQuotationData({ billingEntityId: null }); }} disabled={isLoadingClients}>
                  <SelectTrigger id="client" aria-invalid={Boolean(errors.client)} className="h-10 border-slate-200"><SelectValue placeholder={isLoadingClients ? 'Cargando clientes…' : 'Seleccionar cliente'} /></SelectTrigger>
                  <SelectContent>{clients?.map((client) => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Nombre del proyecto" icon={FolderOpen} required error={errors['project-name']} errorId="project-name-error">
                <Input id="project-name" placeholder="Ej. Playbook regional de TikTok Shop" value={quotationData.project.name} onChange={(event) => updateProjectName(event.target.value)} aria-invalid={Boolean(errors['project-name'])} className="h-10 border-slate-200" />
              </Field>
              <Field label="Modalidad de servicio" error={errors['project-type']} errorId="project-type-error">
                <Select value={quotationData.project.type} onValueChange={updateProjectType} disabled={isLoadingProjectTypes}>
                  <SelectTrigger id="project-type" aria-invalid={Boolean(errors['project-type'])} className="h-10 border-slate-200"><SelectValue placeholder="Seleccionar modalidad" /></SelectTrigger>
                  <SelectContent>{projectTypes?.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Duración" icon={Calendar} error={errors['project-duration']} errorId="project-duration-error">
                <Select value={quotationData.project.duration} onValueChange={updateProjectDuration} disabled={!quotationData.project.type}>
                  <SelectTrigger id="project-duration" aria-invalid={Boolean(errors['project-duration'])} className="h-10 border-slate-200"><SelectValue placeholder="Seleccionar duración" /></SelectTrigger>
                  <SelectContent>{visibleDurationOptions.map((duration) => <SelectItem key={duration.value} value={duration.value}>{duration.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            {quotationData.client && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <Label htmlFor="billing-entity" className="text-sm font-medium text-slate-700">Entidad legal receptora</Label>
                <Select value={quotationData.billingEntityId ? String(quotationData.billingEntityId) : ''} onValueChange={(value) => updateQuotationData({ billingEntityId: Number(value) })} disabled={billingEntitiesLoading || billingEntities.length === 0}>
                  <SelectTrigger id="billing-entity" className="mt-2 h-10 border-slate-200"><SelectValue placeholder={billingEntitiesLoading ? 'Cargando entidades…' : billingEntities.length === 0 ? 'Sin entidades configuradas' : 'Seleccionar razón social'} /></SelectTrigger>
                  <SelectContent>{billingEntities.map((entity) => <SelectItem key={entity.id} value={String(entity.id)}>{entity.razonSocial}{entity.taxId ? ` · ${entity.taxId}` : ''}{entity.country ? ` · ${entity.country}` : ''}</SelectItem>)}</SelectContent>
                </Select>
                {billingEntitiesError && <p className="mt-2 text-xs text-red-700">No pudimos cargar las entidades. <button type="button" className="underline" onClick={() => void refetchBillingEntities()}>Reintentar</button></p>}
                {!billingEntitiesLoading && !billingEntitiesError && billingEntities.length === 0 && <p className="mt-2 text-xs text-amber-700">Configurá la razón social desde <a className="font-medium underline" href="/clients">Clientes</a>.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Card className="border-slate-200 shadow-none">
        <CardContent className="p-5 sm:p-6">
          <div className="mb-5">
            <h3 className="text-base font-semibold text-slate-950">Moneda y tipo de cambio</h3>
            <p className="mt-1 text-sm text-slate-500">El snapshot confirmado será la única referencia para todos los importes de la propuesta.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Moneda de cotización" icon={DollarSign}>
              <Select value={quotationData.quotationCurrency || 'ARS'} onValueChange={(currency) => { if (currency === quotationData.quotationCurrency) return; if (quotationData.teamMembers.length > 0) setPendingCurrency(currency); else updateQuotationCurrency(currency); }}>
                <SelectTrigger id="quotation-currency" className="h-10 border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ARS">Pesos argentinos (ARS)</SelectItem><SelectItem value="USD">Dólares (USD)</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="Tipo de cambio USD/ARS" error={errors['quotation-exchange-rate']} errorId="quotation-exchange-rate-error">
              <Input id="quotation-exchange-rate" inputMode="decimal" value={exchangeRateInput} aria-invalid={parsedExchangeRate == null || parsedExchangeRate <= 0} onChange={(event) => setExchangeRateInput(event.target.value)} onBlur={() => { if (parsedExchangeRate && parsedExchangeRate > 0) { updateQuotationCurrency(quotationData.quotationCurrency || 'ARS', parsedExchangeRate); setExchangeRateInput(String(parsedExchangeRate)); } }} className="h-10 border-slate-200" placeholder="Ej. 1.250,50" />
            </Field>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {exchangeRateLoading ? 'Consultando tipo de cambio vigente…' : exchangeRateError || !exchangeRateReady ? <span className="text-red-700">No hay una referencia vigente disponible. Ingresala manualmente.</span> : <>Referencia vigente: <strong className="text-slate-900">ARS {formatRate(configuredExchangeRate)}</strong> · {exchangeRateSource || 'Configuración manual'} · {formatRateDate(exchangeRateUpdatedAt)}</>}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {exchangeRateReady && configuredExchangeRate !== quotationData.exchangeRateSnapshot && <Button type="button" size="sm" variant="outline" onClick={() => updateQuotationCurrency(quotationData.quotationCurrency || 'ARS', configuredExchangeRate)}>Usar vigente</Button>}
                <Button type="button" size="sm" variant="outline" disabled={isCheckingLiveBlue} onClick={() => void checkLiveBlue()}><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isCheckingLiveBlue ? 'animate-spin' : ''}`} /> Corroborar en vivo</Button>
              </div>
            </div>
            {projectFxForecast && <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><span>Proyección {String(projectFxForecast.month).padStart(2, '0')}/{projectFxForecast.year}: <strong>ARS {formatRate(projectFxForecast.rate)}</strong> · {projectFxForecast.source || 'estimación interna'}</span><Button type="button" size="sm" variant="outline" onClick={() => updateQuotationCurrency(quotationData.quotationCurrency || 'ARS', projectFxForecast.rate)}>Usar proyección</Button></div>}
            {liveBlueError && <p role="alert" className="mt-3 text-red-700">No pudimos consultar las fuentes en vivo.</p>}
            {liveBlue && <div className={`mt-3 rounded-lg border p-3 ${liveBlue.status === 'matched' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p>DolarAPI: {liveBlue.sources.dolarApi ? `ARS ${formatRate(liveBlue.sources.dolarApi.sell)}` : 'no disponible'} · Dólar Hoy: {liveBlue.sources.dolarHoy ? `ARS ${formatRate(liveBlue.sources.dolarHoy.sell)}` : 'no disponible'}</p><p className="mt-1">{liveBlue.status === 'matched' ? 'Las fuentes coinciden dentro del 2%.' : liveBlue.status === 'stale-source' ? 'Una fuente está desactualizada; priorizamos la más reciente.' : liveBlue.status === 'discrepancy' ? `Las fuentes difieren ${liveBlue.differencePercentage?.toFixed(2)}%. Revisá antes de aplicar.` : 'Sólo una fuente respondió; verificá antes de aplicar.'}</p></div><Button type="button" size="sm" onClick={() => updateQuotationCurrency(quotationData.quotationCurrency || 'ARS', liveBlue.recommended.sell)}>Usar ARS {formatRate(liveBlue.recommended.sell)}</Button></div></div>}
            {quotationData.requiresExchangeRateConfirmation && <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">Cotización histórica: confirmá este tipo de cambio para migrarla al pricing actual.</p>}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={pendingCurrency !== null} onOpenChange={(open) => !open && setPendingCurrency(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Cambiar la moneda?</AlertDialogTitle><AlertDialogDescription>Las tarifas y el precio objetivo se recalcularán con el tipo de cambio confirmado. Revisá los totales antes de aprobar.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Conservar moneda actual</AlertDialogCancel><AlertDialogAction onClick={() => { if (pendingCurrency) updateQuotationCurrency(pendingCurrency); setPendingCurrency(null); }}>Recalcular en {pendingCurrency}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function Field({ label, icon: Icon, required, error, errorId, children }: { label: string; icon?: typeof User; required?: boolean; error?: string; errorId?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label className="flex items-center text-sm font-medium text-slate-700">{Icon && <Icon className="mr-1.5 h-3.5 w-3.5 text-slate-400" />}{label}{required && <span className="ml-1 text-red-500">*</span>}</Label>{children}{error && <p id={errorId} role="alert" className="text-xs font-medium text-red-600">{error}</p>}</div>;
}

export default OptimizedBasicInfo;
