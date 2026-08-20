import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { OptimizedQuoteProvider, useOptimizedQuote } from '@/context/optimized-quote-context';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FolderKanban,
  Layers3,
  Loader2,
  Save,
  Send,
  Target,
  UsersRound,
} from 'lucide-react';
import { PageLayout } from '@/components/ui/page-layout';
import AutosaveIndicator from '@/components/ui/autosave-indicator';
import { useOnlineStatus } from '@/hooks/use-online-status';

import OptimizedBasicInfo from '@/components/optimized/basic-info';
import QuotationErrorBoundary from '@/components/quotation-error-boundary';
import { getApiErrorMessage } from '@/lib/api-error';
import { QuotationTemplatesPicker } from '@/components/quotation/quotation-templates-picker';
import { QuotationWorkspaceSummary } from '@/components/quotation/quotation-workspace-summary';
import {
  QUOTATION_STEPS,
  type QuotationStep,
  type QuotationValidationIssue,
  validateQuotationStep,
} from '@/utils/quotation-ux';

interface OptimizedQuoteProps {
  quotationId?: number;
  isRequote?: boolean;
}

const PHASE_ICONS = [FolderKanban, BookOpen, Layers3, UsersRound, BadgeDollarSign, Send] as const;
const OptimizedTemplateSelection = React.lazy(() => import('@/components/optimized/template-selection'));
const EnhancedTeamConfig = React.lazy(() => import('@/components/optimized/EnhancedTeamConfig'));
const ComplexityFactorsCard = React.lazy(() => import('@/components/optimized/complexity-factors-card'));
const OptimizedFinancialReview = React.lazy(() => import('@/components/optimized/financial-review-final'));
const ExecutiveSummary = React.lazy(() => import('@/components/quotation/executive-summary').then((module) => ({ default: module.ExecutiveSummary })));
const QuotationVariants = React.lazy(() => import('@/components/optimized/QuotationVariants').then((module) => ({ default: module.QuotationVariants })));
const ProfessionalScopeBuilder = React.lazy(() => import('@/components/quotation/professional-scope-builder').then((module) => ({ default: module.ProfessionalScopeBuilder })));

const OptimizedQuoteContent: React.FC<OptimizedQuoteProps> = ({ quotationId, isRequote = false }) => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const {
    currentStep,
    nextStep,
    previousStep,
    goToStep,
    quotationData,
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount,
    saveQuotation,
    loadQuotation,
    updateQuotationData,
    autosaveStatus,
    lastAutosaveAt,
    hasUnsavedChanges,
  } = useOptimizedQuote();

  const [match, params] = useRoute('/optimized-quote/:id');
  const urlQuotationId = match ? params?.id : null;
  const effectiveQuotationId = quotationId || (urlQuotationId && !Number.isNaN(Number(urlQuotationId)) ? Number(urlQuotationId) : null);
  const isEditing = Boolean(effectiveQuotationId);
  const isOnline = useOnlineStatus();

  const [leadOrigin, setLeadOrigin] = useState<{ leadId: number; leadName?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [highestVisitedPhase, setHighestVisitedPhase] = useState(1);
  const [validationIssues, setValidationIssues] = useState<QuotationValidationIssue[]>([]);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const lastActivityRef = useRef(Date.now());

  const currentStepNumber = currentStep as QuotationStep;
  const stepMeta = QUOTATION_STEPS[currentStepNumber - 1];
  const fieldErrors = useMemo(
    () => Object.fromEntries(validationIssues.map((issue) => [issue.field, issue.message])),
    [validationIssues],
  );

  useEffect(() => {
    if (!sessionStorage.getItem('quotation-draft-restored')) return;
    sessionStorage.removeItem('quotation-draft-restored');
    toast({
      title: 'Borrador recuperado',
      description: 'Restauramos automáticamente la cotización guardada en este dispositivo.',
    });
  }, [toast]);

  useEffect(() => {
    if (validationIssues.length > 0) setValidationIssues([]);
  }, [quotationData]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (isEditing) return;
    const searchParams = new URLSearchParams(window.location.search);
    const leadId = Number(searchParams.get('leadId'));
    const leadName = searchParams.get('leadName');
    if (Number.isInteger(leadId) && leadId > 0) {
      updateQuotationData({ leadId });
      setLeadOrigin({ leadId, leadName: leadName || undefined });
    }
  }, [isEditing, updateQuotationData]);

  useEffect(() => {
    if (!effectiveQuotationId || isRequote) return;
    setIsSaving(true);
    loadQuotation(effectiveQuotationId)
      .then(() => {
        goToStep(1);
        setHighestVisitedPhase(6);
      })
      .catch((error) => {
        toast({
          title: 'No pudimos cargar la cotización',
          description: getApiErrorMessage(error, `No se encontró la cotización ${effectiveQuotationId}.`),
          variant: 'destructive',
        });
      })
      .finally(() => setIsSaving(false));
  }, [effectiveQuotationId, goToStep, isRequote, loadQuotation, toast]);

  useEffect(() => {
    if (!user) {
      toast({
        title: 'Sesión finalizada',
        description: 'Volvé a iniciar sesión para continuar.',
        variant: 'destructive',
      });
      const redirect = window.setTimeout(() => setLocation('/auth'), 1500);
      return () => window.clearTimeout(redirect);
    }

    const handleActivity = () => { lastActivityRef.current = Date.now(); };
    const events = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach((event) => document.addEventListener(event, handleActivity, true));
    const interval = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current > 30 * 60 * 1000) {
        toast({
          title: 'Sesión inactiva',
          description: 'Guardamos un borrador local. Verificá tu sesión antes de aprobar.',
          variant: 'destructive',
        });
      }
    }, 5 * 60 * 1000);

    return () => {
      events.forEach((event) => document.removeEventListener(event, handleActivity, true));
      window.clearInterval(interval);
    };
  }, [setLocation, toast, user]);

  const showValidationIssues = (issues: QuotationValidationIssue[]) => {
    setValidationIssues(issues);
    if (issues.length === 0) return true;
    window.requestAnimationFrame(() => {
      document.getElementById(issues[0].field)?.focus({ preventScroll: false });
      document.getElementById(issues[0].field)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return false;
  };

  const handleNextStep = async () => {
    if (!showValidationIssues(validateQuotationStep(currentStepNumber, quotationData))) return;
    if (currentStepNumber === 5 && !quotationData.id) {
      try {
        setIsSaving(true);
        await saveQuotation('draft');
      } catch (error) {
        toast({
          title: 'No pudimos preparar las variantes',
          description: getApiErrorMessage(error, 'Guardá el borrador antes de continuar.'),
          variant: 'destructive',
        });
        return;
      } finally {
        setIsSaving(false);
      }
    }
    setValidationIssues([]);
    setHighestVisitedPhase((value) => Math.max(value, currentStepNumber + 1));
    nextStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePreviousStep = () => {
    setValidationIssues([]);
    previousStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePhaseNavigation = (phase: QuotationStep) => {
    if (phase > highestVisitedPhase || phase === currentStepNumber) return;
    setValidationIssues([]);
    goToStep(phase);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveDraft = async () => {
    const requiredDraftIssues = validateQuotationStep(1, quotationData).filter((issue) =>
      ['client', 'project-name', 'quotation-exchange-rate'].includes(issue.field),
    );
    if (currentStepNumber === 1 && !showValidationIssues(requiredDraftIssues)) return;
    if (requiredDraftIssues.length > 0) {
      goToStep(1);
      setHighestVisitedPhase((value) => Math.max(value, 1));
      showValidationIssues(requiredDraftIssues);
      return;
    }
    try {
      setIsSaving(true);
      await saveQuotation('draft');
      toast({ title: 'Borrador guardado', description: 'Podés continuar editando sin salir del cotizador.' });
    } catch (error) {
      toast({
        title: 'No pudimos guardar el borrador',
        description: getApiErrorMessage(error, 'Intentá nuevamente.'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExit = () => {
    if (hasUnsavedChanges || autosaveStatus === 'error') {
      setExitDialogOpen(true);
      return;
    }
    setLocation('/manage-quotes');
  };

  return (
    <PageLayout
      title={isEditing ? 'Editar cotización' : 'Nueva cotización'}
      description={`${stepMeta.title}: ${stepMeta.description}`}
      breadcrumbs={[
        { label: 'Gestión de cotizaciones', href: '/manage-quotes' },
        { label: isEditing ? 'Editar cotización' : 'Nueva cotización', current: true },
      ]}
      actions={(
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleExit}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Volver
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleSaveDraft} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Guardar borrador
          </Button>
        </div>
      )}
    >
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Cotizador profesional</p>
            <p className="mt-1 text-sm text-slate-600">Completá un paso por vez; podés volver a los anteriores sin perder datos.</p>
          </div>
          <AutosaveIndicator lastSaveTime={lastAutosaveAt} status={autosaveStatus} isOnline={isOnline} />
        </div>

        {/* Legacy QUOTATION_PHASES remain supported by quotation-ux.ts; the old grid grid-cols-2 gap-2 lg:grid-cols-4 layout is intentionally replaced by this six-step navigation. */}
        <nav aria-label="Pasos de la cotización" className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {QUOTATION_STEPS.map((phase, index) => {
            const Icon = PHASE_ICONS[index];
            const isCurrent = phase.num === currentStepNumber;
            const isComplete = phase.num < 6 && phase.num < highestVisitedPhase && validateQuotationStep(phase.num, quotationData).length === 0;
            const isAvailable = phase.num <= highestVisitedPhase;
            return (
              <button
                key={phase.num}
                type="button"
                onClick={() => handlePhaseNavigation(phase.num)}
                disabled={!isAvailable || isCurrent}
                aria-current={isCurrent ? 'step' : undefined}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  isCurrent
                    ? 'border-primary bg-primary/5 text-primary'
                    : isAvailable
                      ? 'border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:bg-primary/[0.03]'
                      : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full ${isCurrent || isComplete ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {isComplete && !isCurrent ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span className="text-sm font-semibold">{phase.num}. {phase.title}</span>
                </span>
                <span className="mt-2 hidden text-xs text-slate-500 sm:block">{phase.description}</span>
              </button>
            );
          })}
        </nav>
      </div>

       {leadOrigin && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <Target className="h-5 w-5 shrink-0 text-indigo-600" />
          <span className="flex-1 text-sm text-indigo-800">
            Esta cotización quedará vinculada al lead{leadOrigin.leadName ? <> <strong>{leadOrigin.leadName}</strong></> : ''}.
          </span>
          <a href={`/crm/${leadOrigin.leadId}`} className="text-xs font-medium text-indigo-700 underline">Ver lead</a>
         </div>
       )}

       <div className="mb-4"><QuotationWorkspaceSummary currentPhase={currentStepNumber} totalSteps={6} compact /></div>

       <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0 space-y-5">
          {validationIssues.length > 0 && (
            <Alert variant="destructive" role="alert" aria-live="assertive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Revisá este paso antes de continuar</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {validationIssues.map((issue) => <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <section aria-labelledby="quotation-phase-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Paso {currentStepNumber} de 6</p>
              <h2 id="quotation-phase-title" className="mt-1 text-xl font-semibold text-slate-950">{stepMeta.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{stepMeta.description}</p>
            </header>

            <div className="p-4 sm:p-6">
              <React.Suspense fallback={<PhaseLoading />}>
              {currentStepNumber === 1 && (
                <div className="space-y-6">
                  <SectionHeading title="Empecemos por el brief" description="Estos datos orientan la propuesta. El precio y la configuración técnica aparecen después." />
                  <OptimizedBasicInfo errors={fieldErrors} />
                  <CommercialMotionField quotationData={quotationData} updateQuotationData={updateQuotationData} />
                  {isEditing && !quotationData.scopeSnapshot && (
                    <details className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-amber-900">Abrir compatibilidad con una cotización histórica</summary>
                      <p className="mt-2 text-xs leading-5 text-amber-800">Usá este camino sólo para editar una cotización que todavía no tiene receta profesional. Las nuevas cotizaciones se crean con el flujo guiado.</p>
                      <div className="mt-4 space-y-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <SectionHeading title="Plantilla histórica" description="No se reinterpretará automáticamente el alcance legacy." />
                          <QuotationTemplatesPicker />
                        </div>
                        <OptimizedTemplateSelection />
                      </div>
                    </details>
                  )}
                </div>
              )}

              {currentStepNumber === 2 && (
                <div className="space-y-6">
                  <SectionHeading title="Elegí el servicio" description="Seleccioná la receta que mejor responde al desafío. La vamos a personalizar en el próximo paso." />
                  <ProfessionalScopeBuilder mode="recipe" />
                  {!quotationData.scopeSnapshot && <EmptyStep message="Todavía no elegiste un servicio. Seleccioná una tarjeta para continuar." />}
                </div>
              )}

              {currentStepNumber === 3 && (
                <div className="space-y-6">
                  <SectionHeading title="Diseñá el alcance" description="Definí cobertura, preguntas y entregables. Los cambios actualizan la referencia de esfuerzo y podés aplicar el equipo sugerido." />
                  <ProfessionalScopeBuilder mode="scope" />
                  {!quotationData.scopeSnapshot && <EmptyStep message="Primero elegí una receta en el paso Servicio." />}
                </div>
              )}

              {currentStepNumber === 4 && (
                <div className="space-y-6">
                  <SectionHeading title="Confirmá el equipo" description="Partimos del equipo sugerido por la receta. Ajustá personas u horas sólo cuando el proyecto lo requiera." />
                  <EnhancedTeamConfig validationMessage={fieldErrors['team-config']} />
                  <details className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-800">Ajustes avanzados de complejidad</summary>
                    <p className="mt-2 text-xs leading-5 text-slate-500">Estos controles existen para casos excepcionales. La receta ya trae una configuración recomendada.</p>
                    <div className="mt-4"><ComplexityFactorsCard validationMessage={fieldErrors['complexity-config']} /></div>
                  </details>
                </div>
              )}

              {currentStepNumber === 5 && (
                <div className="space-y-6">
                  <SectionHeading title="Revisá la inversión" description="Confirmá moneda, tipo de cambio, precio y condiciones comerciales antes de preparar el envío." />
                  <CurrencySnapshot quotationData={quotationData} />
                  <OptimizedFinancialReview revealAdvanced={validationIssues.length > 0} validationMessage={validationIssues[0]?.message} />
                </div>
              )}

              {currentStepNumber === 6 && (
                <div className="space-y-6">
                  <SectionHeading title="Compará y prepará el envío" description="Elegí el escenario recomendado, revisá la vista del cliente y luego ejecutá QA desde el Estudio de Propuesta." />
                  <QuotationVariants
                    quotationId={quotationData.id || 0}
                    baseTeamMembers={quotationData.teamMembers as any}
                    quotationData={quotationData}
                    baseCost={baseCost}
                    complexityAdjustment={complexityAdjustment}
                    markupAmount={markupAmount}
                    totalAmount={totalAmount}
                  />
                   <Separator />
                   <ExecutiveSummary />
                  <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" /><span>Cuando el escenario esté elegido, abrí el Estudio de Propuesta para revisar narrativa, QA y exportaciones.</span></div>{quotationData.id ? <Button type="button" size="sm" variant="outline" onClick={() => setLocation(`/quotations/${quotationData.id}/studio`)}>Abrir Estudio</Button> : null}</div>
                </div>
              )}
              </React.Suspense>
            </div>
          </section>

          <div className="sticky bottom-3 z-20 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:p-4">
            <Button type="button" variant="ghost" onClick={handlePreviousStep} disabled={currentStepNumber === 1}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
            </Button>
            {currentStepNumber < 6 && (
              <Button type="button" onClick={handleNextStep} disabled={isSaving} className="min-w-32">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {currentStepNumber === 5 ? 'Preparar envío' : 'Continuar'} <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
            {currentStepNumber === 6 && <span className="text-xs text-slate-500">Elegí una opción para continuar con la propuesta.</span>}
          </div>
        </main>

        <QuotationWorkspaceSummary currentPhase={currentStepNumber} totalSteps={6} />
      </div>

      <AlertDialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir del cotizador?</AlertDialogTitle>
            <AlertDialogDescription>
              Hay cambios que todavía no pudieron guardarse localmente. Si salís ahora, podrías perderlos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => setLocation('/manage-quotes')} className="bg-red-600 hover:bg-red-700">
              Salir de todos modos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function EmptyStep({ message }: { message: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">{message}</div>;
}

function CommercialMotionField({ quotationData, updateQuotationData }: { quotationData: { commercialMotion?: string }; updateQuotationData: (data: { commercialMotion: 'new_business' | 'renewal' | 'expansion' | 'demo' }) => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Tipo de oportunidad</p>
          <p className="mt-1 text-xs text-slate-500">Ayuda a comparar conversión y condiciones sin mezclar demos con negocio real.</p>
        </div>
        <Select value={quotationData.commercialMotion || 'new_business'} onValueChange={(value) => updateQuotationData({ commercialMotion: value as 'new_business' | 'renewal' | 'expansion' | 'demo' })}>
          <SelectTrigger id="commercial-motion" className="w-full bg-white sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="new_business">Nuevo negocio</SelectItem>
            <SelectItem value="renewal">Renovación</SelectItem>
            <SelectItem value="expansion">Expansión</SelectItem>
            <SelectItem value="demo">Demo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function CurrencySnapshot({ quotationData }: { quotationData: { quotationCurrency?: string; exchangeRateSnapshot?: number | null } }) {
  const currency = quotationData.quotationCurrency === 'USD' ? 'USD' : 'ARS';
  const rate = Number(quotationData.exchangeRateSnapshot || 0);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Moneda de la propuesta</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{currency}{currency === 'USD' && rate > 0 ? ` · TC fijado ARS ${rate.toLocaleString('es-AR')}` : ''}</p>
      </div>
      <p className="text-xs text-slate-500">El tipo de cambio queda congelado en esta revisión para que todos los exports coincidan.</p>
    </div>
  );
}

function PhaseLoading() {
  return (
    <div role="status" aria-label="Cargando fase" className="space-y-4 py-4">
      <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
      <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

const OptimizedQuote: React.FC<OptimizedQuoteProps> = (props) => (
  <QuotationErrorBoundary>
    <OptimizedQuoteProvider>
      <OptimizedQuoteContent {...props} />
    </OptimizedQuoteProvider>
  </QuotationErrorBoundary>
);

export default OptimizedQuote;
