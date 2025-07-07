import React, { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { OptimizedQuoteProvider, useOptimizedQuote } from '@/context/optimized-quote-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { ChevronLeft, ChevronRight, Check, Save, ArrowLeft, Building2, FileText, Calendar, Loader2, AlertTriangle, X } from 'lucide-react';
import { PageLayout } from "@/components/ui/page-layout";
import AutosaveIndicator from '@/components/ui/autosave-indicator';
import { DraftRestoreBanner } from '@/components/ui/draft-restore-banner';
import { useOnlineStatus } from '@/hooks/use-online-status';

import OptimizedBasicInfo from '@/components/optimized/basic-info';
import { default as ComplexityFactorsCard } from '@/components/optimized/complexity-factors-card';
import OptimizedTemplateSelection from '@/components/optimized/template-selection';
import EnhancedTeamConfig from '@/components/optimized/EnhancedTeamConfig';
import OptimizedFinancialReview from '@/components/optimized/financial-review-final';
import DeliverableConfiguration from '@/components/quotation/DeliverableConfiguration';
import QuotationErrorBoundary from '@/components/quotation-error-boundary';

interface OptimizedQuoteProps {
  quotationId?: number;
  isRequote?: boolean;
}

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
    saveQuotation,
    loadQuotation,
    updateDeliverables,
    updateAdditionalDeliverableCost
  } = useOptimizedQuote();

  // Get quotation ID from URL if not passed as prop
  const [match, params] = useRoute('/optimized-quote/:id');
  const urlQuotationId = match ? params?.id : null;
  const effectiveQuotationId = quotationId || (urlQuotationId && !isNaN(parseInt(urlQuotationId)) ? parseInt(urlQuotationId) : null);

  const isEditing = Boolean(effectiveQuotationId);
  const [isSaving, setIsSaving] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const isOnline = useOnlineStatus();

  // Prevent accidental page refresh/close when there's unsaved data
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const lastSave = localStorage.getItem('last-autosave-time');
      const hasData = quotationData.project.name || quotationData.teamMembers.length > 0 || quotationData.client;
      const timeSinceLastSave = lastSave ? Date.now() - parseInt(lastSave) : Infinity;
      
      if (hasData && timeSinceLastSave > 5000) { // If more than 5 seconds since last save
        e.preventDefault();
        e.returnValue = 'Tienes cambios sin guardar en tu cotización. ¿Estás seguro de que quieres salir?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [quotationData]);

  // Load quotation if editing
  useEffect(() => {
    console.log('🔍 OptimizedQuote useEffect:', { 
      effectiveQuotationId, 
      isRequote, 
      urlQuotationId,
      quotationId,
      currentQuotationData: quotationData
    });

    if (effectiveQuotationId && !isRequote) {
      console.log('📥 Starting to load quotation:', effectiveQuotationId);

      // Clear any existing data first
      setIsSaving(true);

      loadQuotation(effectiveQuotationId)
        .then(() => {
          console.log('✅ Quotation loaded successfully');
          goToStep(1); // Start from first step when editing
          setIsSaving(false);
        })
        .catch(error => {
          console.error('❌ Error loading quotation:', error);
          setIsSaving(false);
          toast({
            title: "Error al cargar cotización",
            description: `No se pudo cargar la cotización ID ${effectiveQuotationId}: ${error.message || 'Error desconocido'}`,
            variant: "destructive",
          });
        });
    }
  }, [effectiveQuotationId, isRequote, loadQuotation, goToStep, toast]);

  // Monitor user session and show warnings
  useEffect(() => {
    if (!user) {
      toast({
        title: "⚠️ Sesión perdida",
        description: "Tu sesión ha expirado. Redirigiendo al login...",
        variant: "destructive",
      });
      setTimeout(() => setLocation('/auth'), 2000);
      return;
    }

    // Track user activity
    const handleActivity = () => {
      setLastActivity(Date.now());
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Warning for session expiry
    const checkSession = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivity;
      const thirtyMinutes = 30 * 60 * 1000;

      if (timeSinceActivity > thirtyMinutes) {
        toast({
          title: "⏰ Sesión inactiva",
          description: "Has estado inactivo por mucho tiempo. Tu sesión podría expirar pronto.",
          variant: "destructive",
        });
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      clearInterval(checkSession);
    };
  }, [user, lastActivity, setLocation, toast]);

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Validaciones previas
      if (!quotationData.client) {
        toast({
          title: "Cliente requerido",
          description: "Debe seleccionar un cliente antes de guardar.",
          variant: "destructive",
        });
        return;
      }

      if (!quotationData.project.name?.trim()) {
        toast({
          title: "Nombre de proyecto requerido",
          description: "Debe ingresar el nombre del proyecto antes de guardar.",
          variant: "destructive",
        });
        return;
      }

      if (quotationData.teamMembers.length === 0) {
        toast({
          title: "Equipo requerido",
          description: "Debe agregar al menos un miembro al equipo antes de guardar.",
          variant: "destructive",
        });
        return;
      }

      console.log('💾 Iniciando guardado de cotización...');
      const savedQuotation = await saveQuotation();

      toast({
        title: "Cotización guardada",
        description: `La cotización "${quotationData.project.name}" se ha guardado correctamente.`,
      });

      console.log('🎉 Cotización guardada exitosamente, redirigiendo...');
      setLocation('/manage-quotes');
    } catch (error) {
      console.error("❌ Error al guardar:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      toast({
        title: "Error al guardar",
        description: `No se pudo guardar la cotización: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getSteps = () => {
    const baseSteps = [
      { num: 1, title: "Info Básica" },
      { num: 2, title: "Plantilla" },
      { num: 3, title: "Equipo" },
      { num: 4, title: "Complejidad" },
    ];

    if (quotationData.project?.type === 'fee-mensual') {
      baseSteps.push({ num: 5, title: "Entregables" });
      baseSteps.push({ num: 6, title: "Revisión" });
    } else {
      baseSteps.push({ num: 5, title: "Revisión" });
    }

    return baseSteps;
  };

  const steps = getSteps();
  const isLastStep = currentStep === steps[steps.length - 1].num;

  return (
    <PageLayout
      title={isEditing ? 'Editar Cotización' : 'Nueva Cotización'}
      description="Crea y gestiona cotizaciones de manera optimizada"
      breadcrumbs={[
        { label: "Gestión de Cotizaciones", href: "/manage-quotes" },
        { label: isEditing ? 'Editar Cotización' : 'Nueva Cotización', current: true }
      ]}
      actions={
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/manage-quotes")}
            className="text-gray-600 hover:text-gray-800 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>

          

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="text-primary hover:text-primary-dark hover:bg-primary/5"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                Guardar
              </>
            )}
          </Button>
        </div>
      }
    >

      {/* Banner de restauración integrado directamente */}
      {!isEditing && (() => {
        const draft = localStorage.getItem('draft-quotation');
        const dismissed = localStorage.getItem('draft-banner-dismissed');
        
        if (draft && !dismissed) {
          return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg mx-4 mb-4 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Clock className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Borrador encontrado</p>
                    <p className="text-xs text-blue-700">Continúa donde lo dejaste o empezar nuevo</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      try {
                        const draftData = JSON.parse(draft);
                        setQuotationData(draftData);
                        localStorage.removeItem('draft-banner-dismissed');
                        console.log('Borrador restaurado');
                        window.location.reload();
                      } catch (e) {
                        console.error('Error al restaurar borrador:', e);
                      }
                    }}
                    size="sm"
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Continuar
                  </Button>
                  <Button
                    onClick={() => {
                      localStorage.removeItem('draft-quotation');
                      localStorage.removeItem('draft-quotation-backup');
                      localStorage.setItem('draft-banner-dismissed', 'true');
                      setQuotationData({});
                      console.log('Empezar nuevo');
                      window.location.reload();
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Nuevo
                  </Button>
                  <Button
                    onClick={() => {
                      localStorage.setItem('draft-banner-dismissed', 'true');
                      window.location.reload();
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}
      
      {/* TEMPORAL: Botón para crear datos de prueba */}
      <div className="mx-4 mb-4">
        <Button
          onClick={() => {
            const testData = {
              client: { name: 'Cliente Test', id: 1 },
              project: { name: 'Proyecto Test' },
              teamMembers: [{ name: 'Test User', role: 'Developer' }],
              timestamp: Date.now()
            };
            localStorage.setItem('draft-quotation', JSON.stringify(testData));
            localStorage.removeItem('draft-banner-dismissed');
            console.log('📝 Borrador de prueba creado');
            window.location.reload();
          }}
          variant="outline"
          size="sm"
          className="bg-yellow-50 text-yellow-600 border-yellow-200 hover:bg-yellow-100"
        >
          🧪 Crear Borrador Test
        </Button>
      </div>

      {/* Progress indicator */}
      <div className="standard-card mb-6">
        <div className="card-content py-4">
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-1">
              {steps.map((step, index) => (
                <div key={step.num} className="flex items-center">
                  <div 
                    onClick={() => step.num < currentStep && goToStep(step.num)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all 
                    ${step.num < currentStep ? 'cursor-pointer hover:scale-110' : ''}
                    ${currentStep >= step.num 
                      ? 'bg-primary text-white shadow-sm' 
                      : 'bg-gray-100 text-gray-400 border border-gray-200'}`}
                  >
                    {step.num < currentStep ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      step.num
                    )}
                  </div>
                  <span className={`ml-2 text-sm font-medium transition-colors
                    ${currentStep === step.num ? 'text-primary' : 'text-gray-500'}`}>
                    {step.title}
                  </span>
                  {index < steps.length - 1 && (
                    <div className={`mx-4 h-px w-12 transition-colors
                      ${step.num < currentStep ? 'bg-primary' : 'bg-gray-200'}`}></div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Autosave indicator */}
          <div className="flex justify-center mt-4">
            <AutosaveIndicator 
              lastSaveTime={localStorage.getItem('last-autosave-time') ? parseInt(localStorage.getItem('last-autosave-time')!) : undefined}
              hasUnsavedChanges={Date.now() - (parseInt(localStorage.getItem('last-autosave-time') || '0')) > 10000}
              isOnline={isOnline}
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="space-y-6">
        <div className="standard-card">
          <div className="card-content">
            {currentStep === 1 && <OptimizedBasicInfo />}
            {currentStep === 2 && <OptimizedTemplateSelection />}
            {currentStep === 3 && <EnhancedTeamConfig />}
            {currentStep === 4 && <ComplexityFactorsCard />}

            {currentStep === 5 && quotationData.project?.type === 'always-on' && (
              <div className="p-6">
                <DeliverableConfiguration 
                  isAlwaysOnProject={true}
                  onIsAlwaysOnProjectChange={() => {}}
                  deliverables={quotationData.deliverables || []}
                  onDeliverablesChange={updateDeliverables}
                  additionalCost={quotationData.additionalDeliverableCost || 0}
                  onAdditionalCostChange={updateAdditionalDeliverableCost}
                />
              </div>
            )}

            {((currentStep === 5 && quotationData.project?.type !== 'always-on') || 
              (currentStep === 6 && quotationData.project?.type === 'always-on')) && (
              <OptimizedFinancialReview />
            )}
          </div>
        </div>

        {/* Tips section only on first step */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="bg-white border border-neutral-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-base">
                  <span className="bg-primary/5 p-2 rounded-sm mr-3">
                    <Building2 className="h-4 w-4 text-primary" />
                  </span>
                  Tipos de Proyecto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-neutral-600">
                  <strong>On Demand:</strong> Proyecto único con duración específica (3 semanas a 4+ meses).<br/>
                  <strong>Fee Mensual:</strong> Contrato recurrente mínimo 6 meses o 1 año.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-neutral-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-base">
                  <span className="bg-primary/5 p-2 rounded-sm mr-3">
                    <FileText className="h-4 w-4 text-primary" />
                  </span>
                  Entregables
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-neutral-600">
                  En proyectos Always-On puedes definir múltiples entregables con frecuencias específicas.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-neutral-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-base">
                  <span className="bg-primary/5 p-2 rounded-sm mr-3">
                    <Calendar className="h-4 w-4 text-primary" />
                  </span>
                  Presupuesto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-neutral-600">
                  El presupuesto base se calculará automáticamente según el equipo y complejidad seleccionados.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation buttons - Hide the blue button in last step since it has its own action buttons */}
        {!isLastStep && (
          <div className="flex justify-between items-center pt-6 border-t">
            <Button
              variant="ghost"
              onClick={previousStep}
              disabled={currentStep === 1}
              className="flex items-center text-neutral-600 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>

            <div className="flex gap-3">
              <Button
                onClick={nextStep}
                className="bg-primary hover:bg-primary/90 text-white flex items-center px-6"
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Show only back button in last step */}
        {isLastStep && (
          <div className="flex justify-start items-center pt-6 border-t">
            <Button
              variant="ghost"
              onClick={previousStep}
              className="flex items-center text-neutral-600 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

const OptimizedQuote: React.FC<OptimizedQuoteProps> = (props) => {
  return (
    <QuotationErrorBoundary>
      <OptimizedQuoteProvider>
        <OptimizedQuoteContent {...props} />
      </OptimizedQuoteProvider>
    </QuotationErrorBoundary>
  );
};

export default OptimizedQuote;