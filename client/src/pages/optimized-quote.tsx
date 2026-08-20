import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { OptimizedQuoteProvider, useOptimizedQuote } from '@/context/optimized-quote-context';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
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
  Check,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
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
  QUOTATION_PHASES,
  type QuotationPhase,
  type QuotationValidationIssue,
  validateQuotationPhase,
} from '@/utils/quotation-ux';

interface OptimizedQuoteProps {
  quotationId?: number;
  isRequote?: boolean;
}

const PHASE_ICONS = [FolderKanban, UsersRound, BadgeDollarSign, Send] as const;
const OptimizedTemplateSelection = React.lazy(() => import('@/components/optimized/template-selection'));
const EnhancedTeamConfig = React.lazy(() => import('@/components/optimized/EnhancedTeamConfig'));
const ComplexityFactorsCard = React.lazy(() => import('@/components/optimized/complexity-factors-card'));
const DeliverableConfiguration = React.lazy(() => import('@/components/quotation/DeliverableConfiguration'));
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
    updateDeliverables,
    updateAdditionalDeliverableCost,
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

  const currentPhase = currentStep as QuotationPhase;
  const phaseMeta = QUOTATION_PHASES[currentPhase - 1];
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
        setHighestVisitedPhase(4);
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
    if (!showValidationIssues(validateQuotationPhase(currentPhase, quotationData))) return;
    if (currentPhase === 3 && !quotationData.id) {
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
    setHighestVisitedPhase((value) => Math.max(value, currentPhase + 1));
    nextStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePreviousStep = () => {
    setValidationIssues([]);
    previousStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePhaseNavigation = (phase: QuotationPhase) => {
    if (phase > highestVisitedPhase || phase === currentPhase) return;
    setValidationIssues([]);
    goToStep(phase);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveDraft = async () => {
    const requiredDraftIssues = validateQuotationPhase(1, quotationData).filter((issue) =>
      ['client', 'project-name', 'quotation-exchange-rate'].includes(issue.field),
    );
    if (currentPhase === 1 && !showValidationIssues(requiredDraftIssues)) return;
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
      description={`${phaseMeta.title}: ${phaseMeta.description}`}
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
            <p className="mt-1 text-sm text-slate-600">Completá cada fase; podés volver a las anteriores sin perder datos.</p>
          </div>
          <AutosaveIndicator lastSaveTime={lastAutosaveAt} status={autosaveStatus} isOnline={isOnline} />
        </div>

        <nav aria-label="Fases de la cotización" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {QUOTATION_PHASES.map((phase, index) => {
            const Icon = PHASE_ICONS[index];
            const isCurrent = phase.num === currentPhase;
            const isComplete = phase.num < 4 && phase.num < highestVisitedPhase && validateQuotationPhase(phase.num, quotationData).length === 0;
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

      <div className="mb-4"><QuotationWorkspaceSummary currentPhase={currentPhase} compact /></div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0 space-y-5">
          {validationIssues.length > 0 && (
            <Alert variant="destructive" role="alert" aria-live="assertive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Revisá esta fase antes de continuar</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {validationIssues.map((issue) => <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <section aria-labelledby="quotation-phase-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Fase {currentPhase} de 4</p>
              <h2 id="quotation-phase-title" className="mt-1 text-xl font-semibold text-slate-950">{phaseMeta.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{phaseMeta.description}</p>
            </header>

            <div className="p-4 sm:p-6">
              <React.Suspense fallback={<PhaseLoading />}>
              {currentPhase === 1 && (
                <div className="space-y-8">
                  <div>
                    <SectionHeading title="Datos del proyecto" description="Definí la base comercial y la moneda antes de calcular recursos." />
                    <OptimizedBasicInfo errors={fieldErrors} />
                  </div>
                  <Separator />
                  <div>
                    <SectionHeading title="Receta y alcance profesional" description="Partí de un producto probado y ajustá cobertura, módulos, entregables y esfuerzo para este cliente." />
                    <ProfessionalScopeBuilder />
                  </div>
                  <Separator />
                  <div>
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <SectionHeading title="Plantillas legacy" description="Compatibilidad para cotizaciones históricas que todavía no usan recetas profesionales." />
                      {!isEditing && <QuotationTemplatesPicker />}
                    </div>
                    <OptimizedTemplateSelection />
                  </div>
                </div>
              )}

              {currentPhase === 2 && (
                <div className="space-y-8">
                  <div>
                    <SectionHeading title="Equipo" description="Asigná personas, horas y tarifas reales para este trabajo." />
                    <EnhancedTeamConfig validationMessage={fieldErrors['team-config']} />
                  </div>
                  <Separator />
                  <div>
                    <SectionHeading title="Complejidad" description="Traducí el alcance operativo en un impacto económico visible." />
                    <ComplexityFactorsCard validationMessage={fieldErrors['complexity-config']} />
                  </div>
                  {quotationData.project.type === 'always-on' && (
                    <>
                      <Separator />
                      <div>
                        <SectionHeading title="Entregables recurrentes" description="Definí qué recibe el cliente y con qué frecuencia." />
                        <DeliverableConfiguration
                          isAlwaysOnProject
                          showModeToggle={false}
                          quotationCurrency={quotationData.quotationCurrency === 'USD' ? 'USD' : 'ARS'}
                          validationMessage={fieldErrors['deliverables-config']}
                          onIsAlwaysOnProjectChange={() => undefined}
                          deliverables={quotationData.deliverables || []}
                          onDeliverablesChange={updateDeliverables}
                          additionalCost={quotationData.additionalDeliverableCost || 0}
                          onAdditionalCostChange={updateAdditionalDeliverableCost}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {currentPhase === 3 && (
                <div>
                  <SectionHeading title="Precio y rentabilidad" description="Revisá el precio recomendado; los ajustes avanzados quedan plegados hasta que los necesites." />
                  <OptimizedFinancialReview
                    revealAdvanced={validationIssues.length > 0}
                    validationMessage={validationIssues[0]?.message}
                  />
                </div>
              )}

              {currentPhase === 4 && (
                <div className="space-y-8">
                  <div>
                    <SectionHeading title="Vista para el cliente" description="Esta es la información comercial que acompañará la propuesta." />
                    <ExecutiveSummary />
                  </div>
                  <Separator />
                  <QuotationVariants
                    quotationId={quotationData.id || 0}
                    baseTeamMembers={quotationData.teamMembers as any}
                    quotationData={quotationData}
                    baseCost={baseCost}
                    complexityAdjustment={complexityAdjustment}
                    markupAmount={markupAmount}
                    totalAmount={totalAmount}
                  />
                </div>
              )}
              </React.Suspense>
            </div>
          </section>

          <div className="sticky bottom-3 z-20 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:p-4">
            <Button type="button" variant="ghost" onClick={handlePreviousStep} disabled={currentPhase === 1}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
            </Button>
            {currentPhase < 4 && (
              <Button type="button" onClick={handleNextStep} disabled={isSaving} className="min-w-32">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continuar <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
            {currentPhase === 4 && <span className="text-xs text-slate-500">Aprobá desde el bloque de variantes.</span>}
          </div>
        </main>

        <QuotationWorkspaceSummary currentPhase={currentPhase} />
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
