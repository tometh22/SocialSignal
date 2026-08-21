import React from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
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
import { useQuery } from '@tanstack/react-query';
import { Client, ClientBillingEntity, projectDurationOptions } from '@shared/schema';
import { Card, CardContent } from '@/components/ui/card';
import { User, Calendar, FolderOpen, DollarSign, AlertCircle, RefreshCw } from 'lucide-react';
import { parseLocalizedDecimal } from '@shared/utils/quotation-pricing';
import { useCurrency } from '@/hooks/use-currency';

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
};

const OptimizedBasicInfo: React.FC<OptimizedBasicInfoProps> = ({ errors = {} }) => {
  const {
    quotationData,
    updateClient,
    updateProjectName,
    updateProjectType,
    updateProjectDuration,
    updateQuotationCurrency,
    updateQuotationData,
  } = useOptimizedQuote();
  const [exchangeRateInput, setExchangeRateInput] = React.useState(
    quotationData.exchangeRateSnapshot ? String(quotationData.exchangeRateSnapshot) : "",
  );
  const [pendingCurrency, setPendingCurrency] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (quotationData.exchangeRateSnapshot && document.activeElement?.id !== "quotation-exchange-rate") {
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
  const formatRate = (value: number) => new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
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
    enabled: forecastYear > 0 && forecastMonth >= 1 && forecastMonth <= 12,
    retry: false,
  });

  // Consultar lista de clientes
  const { data: clients, isLoading: isLoadingClients, isError: clientsError, refetch: refetchClients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });
  const { data: billingEntities = [], isLoading: billingEntitiesLoading, isError: billingEntitiesError, refetch: refetchBillingEntities } = useQuery<ClientBillingEntity[]>({
    queryKey: [`/api/clients/${quotationData.client?.id || 0}/billing-entities`],
    enabled: Boolean(quotationData.client?.id),
  });
  React.useEffect(() => {
    if (!quotationData.client || quotationData.billingEntityId || billingEntities.length === 0) return;
    const preferred = billingEntities.find((entity) => entity.isDefault) || billingEntities[0];
    updateQuotationData({ billingEntityId: preferred.id });
  }, [billingEntities, quotationData.billingEntityId, quotationData.client, updateQuotationData]);

  // Consultar tipos de proyecto
  const { data: projectTypes, isLoading: isLoadingProjectTypes, isError: projectTypesError, refetch: refetchProjectTypes } = useQuery<{value: string, label: string}[]>({
    queryKey: ['/api/options/project-types'],
  });

  // Loading spinner component para reutilizar
  const LoadingSpinner = () => (
    <svg className="animate-spin h-4 w-4 text-primary mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );

  return (
    <div className="space-y-6">
      {(clientsError || projectTypesError) && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>No pudimos cargar {clientsError && projectTypesError ? 'clientes ni modalidades' : clientsError ? 'los clientes' : 'las modalidades de proyecto'}.</span>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => { refetchClients(); refetchProjectTypes(); }}>
            <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
          </Button>
        </div>
      )}
      {/* Formulario principal y datos del cliente en un solo componente */}
      <Card className="bg-white border border-neutral-100 shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-6">
            {/* Panel izquierdo: Cliente y Nombre del Proyecto */}
            <div className="w-full max-w-4xl space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cliente */}
                <div className="space-y-2">
                  <Label htmlFor="client" className="text-sm font-medium text-gray-700 flex items-center">
                    <User className="h-3.5 w-3.5 mr-1.5 text-primary/70" />
                    Cliente <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Select
                    value={quotationData.client ? String(quotationData.client.id) : ''}
                    onValueChange={(value) => {
                      const selectedClient = clients?.find(client => client.id === parseInt(value));
                      updateClient(selectedClient || null);
                      updateQuotationData({ billingEntityId: null });
                    }}
                    disabled={isLoadingClients}
                  >
                    <SelectTrigger id="client" aria-invalid={Boolean(errors.client)} aria-describedby={errors.client ? 'client-error' : undefined} className="w-full bg-white border-neutral-200 h-9 focus:ring-1 focus:ring-primary/20 focus:border-primary/60 text-gray-800">
                      <SelectValue placeholder="Seleccionar cliente" />
                    </SelectTrigger>
                    <SelectContent className="border border-neutral-200 bg-white">
                      {isLoadingClients ? (
                        <div className="py-2 px-3 text-sm text-gray-500 flex items-center justify-center">
                          <LoadingSpinner />
                          Cargando clientes...
                        </div>
                      ) : (
                        clients?.map((client) => (
                          <SelectItem 
                            key={client.id} 
                            value={String(client.id)}
                            className="hover:bg-neutral-50"
                          >
                            <div className="flex items-center gap-2">
                              {client.logoUrl ? (
                                <div className="h-4 w-4 rounded overflow-hidden flex-shrink-0">
                                  <img 
                                    src={client.logoUrl} 
                                    alt={`${client.name} logo`} 
                                    className="h-full w-full object-contain"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="h-4 w-4 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                                  <span className="text-[9px] font-medium text-primary">
                                    {client.name.substring(0, 2).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              {client.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FieldError id="client-error" message={errors.client} />
                </div>

                {/* Nombre del Proyecto */}
                <div className="space-y-2">
                  <Label htmlFor="project-name" className="text-sm font-medium text-gray-700 flex items-center">
                    <FolderOpen className="h-3.5 w-3.5 mr-1.5 text-primary/70" />
                    Nombre del Proyecto <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="project-name"
                    placeholder="Ej. Análisis de Mercado Q2 2023"
                    value={quotationData.project.name}
                    onChange={(e) => updateProjectName(e.target.value)}
                    aria-invalid={Boolean(errors['project-name'])}
                    aria-describedby={errors['project-name'] ? 'project-name-error' : undefined}
                    className="bg-white border-neutral-200 h-9 focus:ring-1 focus:ring-primary/20 focus:border-primary/60 text-gray-800"
                  />
                  <FieldError id="project-name-error" message={errors['project-name']} />
                </div>
              </div>

              {quotationData.client && (
                <div className="space-y-2">
                  <Label htmlFor="billing-entity" className="text-sm font-medium text-gray-700">Entidad legal que recibirá la propuesta</Label>
                  <Select
                    value={quotationData.billingEntityId ? String(quotationData.billingEntityId) : ''}
                    onValueChange={(value) => updateQuotationData({ billingEntityId: Number(value) })}
                    disabled={billingEntitiesLoading || billingEntities.length === 0}
                  >
                    <SelectTrigger id="billing-entity" className="h-9 w-full border-neutral-200 bg-white"><SelectValue placeholder={billingEntitiesLoading ? 'Cargando entidades…' : billingEntities.length === 0 ? 'El cliente no tiene entidades configuradas' : 'Seleccionar razón social'} /></SelectTrigger>
                    <SelectContent>
                      {billingEntities.map((entity) => (
                        <SelectItem key={entity.id} value={String(entity.id)}>
                          {entity.razonSocial}{entity.taxId ? ` · ${entity.taxId}` : ''}{entity.country ? ` · ${entity.country}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {billingEntitiesError && (
                    <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      <span>No pudimos cargar las entidades legales.</span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => refetchBillingEntities()}>Reintentar</Button>
                    </div>
                  )}
                  {!billingEntitiesLoading && !billingEntitiesError && billingEntities.length === 0 && (
                    <p className="text-xs text-amber-700">Configurá la razón social desde <a className="font-medium underline" href="/clients">Clientes</a> y volvé a esta cotización.</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {/* Tipo de Proyecto */}
                <div className="space-y-2">
                    <Label htmlFor="project-type" className="text-sm font-medium text-gray-700">Modalidad de servicio</Label>
                  <Select
                    value={quotationData.project.type}
                    onValueChange={updateProjectType}
                    disabled={isLoadingProjectTypes}
                  >
                    <SelectTrigger id="project-type" aria-invalid={Boolean(errors['project-type'])} aria-describedby={errors['project-type'] ? 'project-type-error' : undefined} className="w-full bg-white border-neutral-200 h-9 focus:ring-1 focus:ring-primary/20 focus:border-primary/60 text-gray-800">
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent className="border border-neutral-200 bg-white">
                      {isLoadingProjectTypes ? (
                        <div className="py-2 px-3 text-sm text-gray-500 flex items-center justify-center">
                          <LoadingSpinner />
                          Cargando tipos...
                        </div>
                      ) : (
                        projectTypes?.map((type) => (
                          <SelectItem 
                            key={type.value} 
                            value={type.value}
                            className="hover:bg-neutral-50"
                          >
                            {type.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FieldError id="project-type-error" message={errors['project-type']} />
                </div>

                {/* Duración del Proyecto */}
                {quotationData.project.type && (
                  <div className="space-y-2">
                    <Label htmlFor="project-duration" className="text-sm font-medium text-gray-700 flex items-center">
                      <Calendar className="h-3.5 w-3.5 mr-1.5 text-primary/70" />
                      Duración
                    </Label>
                    <Select
                      value={quotationData.project.duration}
                      onValueChange={updateProjectDuration}
                    >
                      <SelectTrigger id="project-duration" aria-invalid={Boolean(errors['project-duration'])} aria-describedby={errors['project-duration'] ? 'project-duration-error' : undefined} className="w-full bg-white border-neutral-200 h-9 focus:ring-1 focus:ring-primary/20 focus:border-primary/60 text-gray-800">
                        <SelectValue placeholder="Seleccionar duración" />
                      </SelectTrigger>
                      <SelectContent className="border border-neutral-200 bg-white">
                        {quotationData.project.type === 'on-demand' && 
                          projectDurationOptions["on-demand"].map((duration) => (
                            <SelectItem 
                              key={duration.value} 
                              value={duration.value}
                              className="hover:bg-neutral-50"
                            >
                              {duration.label}
                            </SelectItem>
                          ))
                        }
                        {quotationData.project.type === 'fee-mensual' && 
                          projectDurationOptions["fee-mensual"].map((duration) => (
                            <SelectItem 
                              key={duration.value} 
                              value={duration.value}
                              className="hover:bg-neutral-50"
                            >
                              {duration.label}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                    <FieldError id="project-duration-error" message={errors['project-duration']} />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="quotation-currency" className="flex items-center text-sm font-medium text-gray-700">
                    <DollarSign className="mr-1.5 h-3.5 w-3.5 text-primary/70" />
                    Moneda de cotización
                  </Label>
                  <Select
                    value={quotationData.quotationCurrency || "ARS"}
                    onValueChange={(currency) => {
                      if (currency === quotationData.quotationCurrency) return;
                      if (quotationData.teamMembers.length > 0) {
                        setPendingCurrency(currency);
                      } else {
                        updateQuotationCurrency(currency);
                      }
                    }}
                  >
                    <SelectTrigger id="quotation-currency" className="h-9 w-full border-neutral-200 bg-white text-gray-800 [&>span]:text-center">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">Pesos argentinos (ARS)</SelectItem>
                      <SelectItem value="USD">Dólares (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-center text-[11px] text-muted-foreground">
                    Definí desde el inicio cómo se convierten y muestran las tarifas del equipo.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quotation-exchange-rate" className="text-sm font-medium text-gray-700">
                    Tipo de cambio USD/ARS
                  </Label>
                  <Input
                    id="quotation-exchange-rate"
                    inputMode="decimal"
                    value={exchangeRateInput}
                    aria-invalid={parsedExchangeRate == null || parsedExchangeRate <= 0}
                    aria-describedby={errors['quotation-exchange-rate'] ? 'quotation-exchange-rate-error' : undefined}
                    onChange={(event) => setExchangeRateInput(event.target.value)}
                    onBlur={() => {
                      if (parsedExchangeRate && parsedExchangeRate > 0) {
                        updateQuotationCurrency(quotationData.quotationCurrency || "ARS", parsedExchangeRate);
                        setExchangeRateInput(String(parsedExchangeRate));
                      }
                    }}
                    className="h-9 text-center"
                    placeholder="Ej. 1.250,50"
                  />
                  <FieldError id="quotation-exchange-rate-error" message={errors['quotation-exchange-rate']} />
                  <p className="text-center text-[11px] text-muted-foreground">
                    Snapshot obligatorio: todas las conversiones de esta propuesta usan exactamente este valor.
                  </p>
                  <details className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-[11px]">
                    <summary className="cursor-pointer text-center font-medium text-slate-600">Verificar tipo de cambio y fuentes</summary>
                    <div className="mt-2 space-y-2">
                    <div className="text-center text-slate-600">
                      {exchangeRateLoading ? 'Consultando TC vigente…' : exchangeRateError || !exchangeRateReady ? (
                        <span className="text-red-700">No hay un TC vigente disponible; ingresalo manualmente o verificá las fuentes.</span>
                      ) : (
                        <>
                          Vigente: <strong>ARS {formatRate(configuredExchangeRate)}</strong>
                          {' · '}{exchangeRateSource || 'Configuración manual'}
                          {' · '}{formatRateDate(exchangeRateUpdatedAt)}
                        </>
                      )}
                    </div>
                    <div className="flex flex-col justify-center gap-2 sm:flex-row">
                      {exchangeRateReady && configuredExchangeRate !== quotationData.exchangeRateSnapshot && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => updateQuotationCurrency(quotationData.quotationCurrency || 'ARS', configuredExchangeRate)}
                        >
                          Usar TC vigente
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        disabled={isCheckingLiveBlue}
                        onClick={() => checkLiveBlue()}
                      >
                        <RefreshCw className={`mr-1.5 h-3 w-3 ${isCheckingLiveBlue ? 'animate-spin' : ''}`} />
                        Corroborar en vivo
                      </Button>
                    </div>
                    {projectFxForecast && (
                      <div className="rounded border border-violet-200 bg-violet-50 p-2 text-center text-violet-900">
                        Proyección para {String(projectFxForecast.month).padStart(2, '0')}/{projectFxForecast.year}:{' '}
                        <strong>ARS {formatRate(projectFxForecast.rate)}</strong>
                        {' · '}{projectFxForecast.source || 'estimación interna'}
                        <div className="mt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 border-violet-300 text-[11px]"
                            onClick={() => updateQuotationCurrency(quotationData.quotationCurrency || 'ARS', projectFxForecast.rate)}
                          >
                            Usar proyección del mes
                          </Button>
                        </div>
                      </div>
                    )}
                    {liveBlueError && (
                      <p role="alert" className="text-center text-red-700">No pudimos consultar las fuentes en vivo.</p>
                    )}
                    {liveBlue && (
                      <div className={`rounded border p-2 ${liveBlue.status === 'matched' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                        <div className="grid grid-cols-1 gap-1 text-center sm:grid-cols-2">
                          <span>DolarAPI: {liveBlue.sources.dolarApi ? `ARS ${formatRate(liveBlue.sources.dolarApi.sell)} · ${formatRateDate(liveBlue.sources.dolarApi.updatedAt)}` : 'no disponible'}</span>
                          <span>Dólar Hoy: {liveBlue.sources.dolarHoy ? `ARS ${formatRate(liveBlue.sources.dolarHoy.sell)} · ${formatRateDate(liveBlue.sources.dolarHoy.updatedAt)}` : 'no disponible'}</span>
                        </div>
                        <p className="mt-1 text-center">
                          {liveBlue.status === 'matched'
                            ? 'Las fuentes coinciden dentro del 2%.'
                            : liveBlue.status === 'stale-source'
                              ? 'Una fuente está desactualizada; recomendamos la publicación más reciente.'
                              : liveBlue.status === 'discrepancy'
                                ? `Las fuentes difieren ${liveBlue.differencePercentage?.toFixed(2)}%. Revisá antes de aplicar.`
                                : 'Sólo una fuente respondió; verificá antes de aplicar.'}
                        </p>
                        <div className="mt-2 text-center">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 text-[11px]"
                            onClick={() => updateQuotationCurrency(quotationData.quotationCurrency || 'ARS', liveBlue.recommended.sell)}
                          >
                            Usar ARS {formatRate(liveBlue.recommended.sell)} ({liveBlue.recommended.source})
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                    {quotationData.requiresExchangeRateConfirmation && (
                    <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-2 text-center text-[11px] text-amber-800">
                      Cotización histórica: confirmá este TC para migrarla al pricing actual. Hasta entonces se conservan sus totales guardados.
                    </p>
                  )}
                  </details>
              </div>
            </div>

            </div>

            {/* Panel derecho: Información del cliente o ayuda contextual */}
            <div className="flex w-full max-w-4xl border-t border-neutral-100 pt-6">
              {quotationData.client ? (
                <div className="w-full self-center rounded-md bg-slate-50 p-4">
                  <div className="flex items-center mb-3">
                    <User className="h-4 w-4 mr-2 text-primary" />
                    <h3 className="text-sm font-medium text-gray-700">Información de Contacto</h3>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    {quotationData.client.logoUrl ? (
                      <div className="h-10 w-10 rounded-md overflow-hidden border border-gray-200 bg-white flex items-center justify-center">
                        <img 
                          src={quotationData.client.logoUrl} 
                          alt={`${quotationData.client.name} logo`} 
                          className="h-full w-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="h-10 w-10 bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-primary">
                          {quotationData.client.name.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="font-medium text-gray-700">{quotationData.client.name}</span>
                  </div>

                  <div className="space-y-2 text-sm">

                    {quotationData.client.contactName && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Contacto:</span>
                        <span className="text-gray-700">{quotationData.client.contactName}</span>
                      </div>
                    )}

                    {quotationData.client.contactEmail && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Email:</span>
                        <span className="text-gray-700">{quotationData.client.contactEmail}</span>
                      </div>
                    )}

                    {quotationData.client.contactPhone && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Teléfono:</span>
                        <span className="text-gray-700">{quotationData.client.contactPhone}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex h-full w-full flex-col justify-center rounded-md bg-blue-50 p-4 text-center">
                  <h3 className="text-sm font-medium text-blue-700 mb-2">Información Inicial</h3>
                  <p className="text-xs text-blue-600">Seleccioná un cliente e ingresá un nombre de proyecto para comenzar.</p>
                  <p className="text-xs text-blue-500 mt-2">Los campos marcados con <span className="text-red-500">*</span> son obligatorios.</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={pendingCurrency !== null} onOpenChange={(open) => !open && setPendingCurrency(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar la moneda de la cotización?</AlertDialogTitle>
            <AlertDialogDescription>
              Las tarifas del equipo y el precio objetivo se recalcularán usando el tipo de cambio confirmado. Revisá los totales antes de aprobar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conservar moneda actual</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingCurrency) updateQuotationCurrency(pendingCurrency);
              setPendingCurrency(null);
            }}>
              Recalcular en {pendingCurrency}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OptimizedBasicInfo;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="text-xs font-medium text-red-600">{message}</p>;
}
