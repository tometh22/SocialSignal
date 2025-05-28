import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { OptimizedQuoteProvider, useOptimizedQuote } from '@/context/optimized-quote-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Check, Save, ArrowLeft, Building2, FileText, Calendar, Loader2 } from 'lucide-react';

import OptimizedBasicInfo from '@/components/optimized/basic-info';
import OptimizedTemplateSelection from '@/components/optimized/template-selection-redesigned';
import OptimizedTeamConfig from '@/components/optimized/SimpleTeamConfig';
import OptimizedFinancialReview from '@/components/optimized/review-ultra-compact';
import DeliverableConfiguration from '@/components/quotation/DeliverableConfiguration';

interface OptimizedQuoteProps {
  quotationId?: number;
  isRequote?: boolean;
}

const OptimizedQuote: React.FC<OptimizedQuoteProps> = ({ quotationId, isRequote = false }) => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const {
    currentStep,
    nextStep,
    previousStep,
    goToStep,
    quotationData,
    saveQuotation
  } = useOptimizedQuote();

  const isEditing = Boolean(quotationId);
  const [isSaving, setIsSaving] = useState(false);

  // Forzar navegación al paso correcto para edición
  useEffect(() => {
    if (quotationId && !isRequote) {
      console.log(`Forzando navegación al paso 4 para edición de cotización ${quotationId}`);
      goToStep(4);
    }
  }, [quotationId, isRequote, goToStep]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await saveQuotation();
      toast({
        title: "Cotización guardada",
        description: "La cotización se ha guardado correctamente.",
      });
      setLocation('/manage-quotes');
    } catch (error) {
      console.error("Error al guardar:", error);
      toast({
        title: "Error al guardar",
        description: "No se pudo guardar la cotización. Por favor, intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-neutral-100 flex flex-col">
      {/* Header compacto principal */}
      <div className="bg-white border-b border-neutral-200 shadow-sm">
        <div className="container flex items-center justify-between h-12 px-4">
          {/* Información del cliente - ultra compacta */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1 text-gray-600">
              <Building2 className="h-3 w-3" />
              <span className="font-medium">{quotationData.client?.name || 'Cliente'}</span>
            </div>
            <div className="text-gray-400">•</div>
            <div className="flex items-center gap-1 text-gray-600">
              <FileText className="h-3 w-3" />
              <span>#{quotationId || 'Nueva'}</span>
            </div>
            <div className="text-gray-400">•</div>
            <div className="flex items-center gap-1 text-gray-600">
              <Calendar className="h-3 w-3" />
              <span>{new Date().toLocaleDateString()}</span>
            </div>
          </div>
          
          {/* Progreso horizontal minimalista */}
          <div className="flex items-center justify-center flex-1 px-8">
            <div className="flex items-center gap-1">
              {[
                { num: 1, title: "Info" },
                { num: 2, title: "Plantilla" },
                { num: 3, title: "Equipo" },
                ...(quotationData.project?.type === 'always-on' ? [{ num: 4, title: "Entregables" }] : []),
                { num: quotationData.project?.type === 'always-on' ? 5 : 4, title: "Revisión" }
              ].map((step, index, array) => (
                <div key={step.num} className="flex items-center">
                  <div 
                    onClick={() => step.num < currentStep && goToStep(step.num)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all 
                    ${step.num < currentStep ? 'cursor-pointer hover:scale-110' : ''}
                    ${currentStep >= step.num 
                      ? 'bg-primary text-white shadow-sm' 
                      : 'bg-gray-100 text-gray-400 border border-gray-200'}`}
                  >
                    {step.num < currentStep ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      step.num
                    )}
                  </div>
                  <span className={`ml-1.5 text-xs font-medium transition-colors
                    ${currentStep === step.num ? 'text-primary' : 'text-gray-500'}`}>
                    {step.title}
                  </span>
                  {index < array.length - 1 && (
                    <div className={`mx-3 h-px w-8 transition-colors
                      ${step.num < currentStep ? 'bg-primary' : 'bg-gray-200'}`}></div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Botones de acción */}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/manage-quotes")}
              className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 h-8 px-3"
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              Volver
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="text-primary hover:text-primary-dark hover:bg-primary/5 h-8 px-3"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-3 w-3 mr-1" />
                  Guardar
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Header de paso actual - ULTRA COMPACTO */}
      <div className="bg-gray-50 border-b px-4 py-1">
        <h2 className="text-xs font-medium text-gray-600">
          {currentStep === 1 && "Info"}
          {currentStep === 2 && "Plantilla"}
          {currentStep === 3 && "Equipo"}
          {currentStep === 4 && quotationData.project?.type === 'always-on' && "Entregables"}
          {((currentStep === 4 && quotationData.project?.type !== 'always-on') || 
            (currentStep === 5 && quotationData.project?.type === 'always-on')) && "Revisión"}
        </h2>
      </div>
      
      {/* Contenido principal compacto */}
      <div className="flex-1 overflow-auto">
        <div className="container py-2">
          <div className="bg-white border border-neutral-100 shadow-sm rounded-lg">
            <div className="p-0 overflow-visible">
              {currentStep === 1 && <OptimizedBasicInfo />}
              {currentStep === 2 && <OptimizedTemplateSelection />}
              {currentStep === 3 && <OptimizedTeamConfig />}
              
              {currentStep === 4 && quotationData.project?.type === 'always-on' && (
                <div className="p-6">
                  <DeliverableConfiguration 
                    isAlwaysOnProject={true}
                    onIsAlwaysOnProjectChange={(value) => {
                      console.log("Always-On mode:", value);
                    }}
                    deliverables={quotationData.deliverables || []}
                    onDeliverablesChange={(deliverables) => {
                      console.log("Actualizando entregables:", deliverables);
                    }}
                    additionalCost={quotationData.additionalDeliverableCost || 0}
                    onAdditionalCostChange={(cost) => {
                      console.log("Actualizando costo adicional:", cost);
                    }}
                  />
                </div>
              )}
              
              {((currentStep === 4 && quotationData.project?.type !== 'always-on') || 
                (currentStep === 5 && quotationData.project?.type === 'always-on')) && (
                <OptimizedFinancialReview />
              )}
            </div>
          </div>
        </div>
        
        {/* Tips section solo en primer paso */}
        {currentStep === 1 && (
          <div className="container py-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
              <Card className="bg-white border border-neutral-100 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center text-base">
                    <span className="bg-primary/5 p-2 rounded-sm mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                      </svg>
                    </span>
                    Tipos de Proyecto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-neutral-600">
                    Define si es un proyecto único o "Always-On" (retainer mensual).
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-white border border-neutral-100 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center text-base">
                    <span className="bg-primary/5 p-2 rounded-sm mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Z"/>
                      </svg>
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
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 3v18h18"/>
                      </svg>
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
          </div>
        )}
      </div>
      
      {/* Footer con botones de navegación */}
      <div className="border-t border-neutral-200 bg-white py-4 px-5 shadow-sm sticky bottom-0">
        <div className="container flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={previousStep}
            disabled={currentStep === 1}
            className="flex items-center text-neutral-600 hover:text-neutral-800"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          
          <div className="flex gap-3">
            {((currentStep === 4 && quotationData.project?.type !== 'always-on') || 
              (currentStep === 5 && quotationData.project?.type === 'always-on')) ? (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90 text-white px-6"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {isEditing ? "Finalizar Actualización" : isRequote ? "Finalizar Recotización" : "Finalizar Cotización"}
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                className="bg-primary hover:bg-primary/90 text-white flex items-center px-6"
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptimizedQuote;