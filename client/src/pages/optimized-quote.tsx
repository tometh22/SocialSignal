import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { OptimizedQuoteProvider, useOptimizedQuote } from '@/context/optimized-quote-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Check, Save, ArrowUpDown } from 'lucide-react';

// Importación de los componentes para cada paso
import OptimizedBasicInfo from '@/components/optimized/basic-info';
import { DirectComplexitySelection } from '@/components/optimized/minimal-complexity';
import OptimizedTemplateSelection from '@/components/optimized/template-selection-redesigned';
import OptimizedTeamConfig from '@/components/optimized/team-config';
import OptimizedFinancialReview from '@/components/optimized/financial-review-redesigned';

// Componente principal que contiene el flujo de cotización optimizado
const OptimizedQuote = () => {
  return (
    <OptimizedQuoteProvider>
      <OptimizedQuoteContent />
    </OptimizedQuoteProvider>
  );
};

// Contenido principal del flujo optimizado
const OptimizedQuoteContent = () => {
  const { 
    currentStep, 
    nextStep, 
    previousStep, 
    goToStep,
    saveQuotation,
    quotationData,
    updateTemplate,
    isSavingInProgress
  } = useOptimizedQuote();
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Ya no necesitamos escuchar el evento personalizado para avanzar automáticamente
  // ya que ahora queremos que el usuario permanezca en la pestaña "Detalles y Ajustes"
  // y avance manualmente cuando esté listo

  // Validación por paso
  const validateCurrentStep = (): boolean => {
    if (currentStep === 1) {
      // Validar información básica
      if (!quotationData.client) {
        toast({
          title: "Cliente requerido",
          description: "Por favor, selecciona un cliente para la cotización",
          variant: "destructive",
        });
        return false;
      }
      
      if (!quotationData.project.name.trim()) {
        toast({
          title: "Nombre de proyecto requerido",
          description: "Por favor, ingresa un nombre para el proyecto",
          variant: "destructive",
        });
        return false;
      }
      
      return true;
    }
    
    if (currentStep === 2) {
      // En este paso, ahora usamos la opción DirectComplexitySelection que establece template = null
      // y configura directamente los factores de complejidad, así que debemos aceptar siempre
      
      console.log("Paso 2: Factores de complejidad configurados directamente.");
      
      // Asegurémonos de que teamMembers esté inicializado
      quotationData.teamMembers = quotationData.teamMembers || [];
      
      // Siempre permitir continuar con este nuevo enfoque
      return true;
    }
    
    if (currentStep === 3) {
      // Validar configuración de equipo
      if (quotationData.teamMembers.length === 0) {
        toast({
          title: "Equipo requerido",
          description: "Por favor, añade al menos un miembro al equipo",
          variant: "destructive",
        });
        return false;
      }
      
      return true;
    }
    
    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      nextStep();
    }
  };

  const handleSave = async () => {
    if (!validateCurrentStep()) {
      return;
    }

    try {
      const quotationId = await saveQuotation();
      
      // Si se devuelve -1, significa que ya hay una operación en progreso
      if (quotationId === -1) {
        return;
      }
      
      toast({
        title: "Cotización guardada",
        description: `La cotización se ha guardado correctamente con ID: ${quotationId}`,
      });
      
      // Redirigir a la página de gestión de cotizaciones
      setLocation('/quotations');
    } catch (error) {
      console.error("Error al guardar:", error);
      toast({
        title: "Error al guardar",
        description: "No se pudo guardar la cotización. Por favor, intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header integrado con la navegación de pasos */}
      <div className="border-b bg-white shadow-sm sticky top-0 z-10">
        <div className="container py-3">
          <div className="flex flex-col">
            {/* Título principal */}
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-medium text-gray-800">Nueva Cotización</h1>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs h-8 border-slate-200 text-slate-700"
                  onClick={() => setLocation('/')}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs h-8 border-primary/30 text-primary bg-primary/5"
                  onClick={handleSave}
                  disabled={isSavingInProgress}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" /> 
                  {isSavingInProgress ? "Guardando..." : "Guardar borrador"}
                </Button>
              </div>
            </div>
            
            {/* Barra de progreso y pasos */}
            <div className="relative">
              {/* Barra de progreso */}
              <div className="absolute h-0.5 bg-neutral-100 left-0 right-0 top-[18px]"></div>
              <div className="absolute h-0.5 bg-primary left-0 top-[18px]" style={{ 
                width: `${(currentStep-1)/(4-1)*100}%`, 
                transition: 'width 0.3s ease-out' 
              }}></div>
              
              {/* Indicadores de pasos */}
              <div className="grid grid-cols-4 relative">
                {[
                  { num: 1, title: "Información Básica" },
                  { num: 2, title: "Selección de Plantilla" },
                  { num: 3, title: "Configuración de Equipo" },
                  { num: 4, title: "Revisión y Ajustes" }
                ].map((step) => (
                  <div key={step.num} className="flex flex-col items-center">
                    <div 
                      onClick={() => step.num < currentStep && goToStep(step.num)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs z-10 mb-1 transition-all 
                      ${step.num < currentStep ? 'cursor-pointer hover:scale-110' : ''}
                      ${currentStep >= step.num 
                        ? 'bg-primary text-white shadow-md' 
                        : 'bg-white text-neutral-400 border border-neutral-200'}`}
                    >
                      {step.num}
                    </div>
                    <span className={`text-xs font-medium text-center transition-colors pb-2
                      ${currentStep === step.num ? 'text-primary' : 'text-neutral-500'}`}>
                      {step.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="container py-6">
          
          {/* Content for current step */}
          <Card className="bg-white border border-neutral-100 shadow-sm mb-10 scale-in">
            <CardContent className="p-0 overflow-visible">
              {currentStep === 1 && <OptimizedBasicInfo />}
              {currentStep === 2 && <OptimizedTemplateSelection />}
              {currentStep === 3 && <OptimizedTeamConfig />}
              {currentStep === 4 && <OptimizedFinancialReview />}
            </CardContent>
          </Card>
          
          {/* Tips section */}
          {currentStep === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10 fade-in">
              <Card className="bg-white border border-neutral-100 shadow-sm hover:shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center text-base">
                    <span className="bg-primary/5 p-2 rounded-sm mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                      </svg>
                    </span>
                    <span className="font-medium">Consejo</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-neutral-600">
                    Al seleccionar el tipo de proyecto, considera el alcance y objetivos para una cotización más precisa.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-white border border-neutral-100 shadow-sm hover:shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center text-base">
                    <span className="bg-accent/5 p-2 rounded-sm mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                      </svg>
                    </span>
                    <span className="font-medium">Recomendación</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-neutral-600">
                    Para proyectos de media o larga duración, te recomendamos incluir al menos un experto en análisis de datos.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-white border border-neutral-100 shadow-sm hover:shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center text-base">
                    <span className="bg-success/5 p-2 rounded-sm mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>
                    </span>
                    <span className="font-medium">Plantillas populares</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-neutral-600">
                    Las plantillas más utilizadas para este tipo de proyectos son "Informe Ejecutivo" y "Análisis de Tendencias".
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer with navigation buttons */}
      <div className="border-t border-neutral-200 bg-white py-4 px-5 z-50 shadow-sm sticky bottom-0">
        <div className="container flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={previousStep}
            disabled={currentStep === 1}
            className="flex items-center text-neutral-600 hover:text-neutral-800 hover:bg-neutral-50"
          >
            <ChevronLeft className="mr-1.5 h-4 w-4" />
            Anterior
          </Button>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={isSavingInProgress}
              className="bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 shadow-none"
            >
              <Save className="mr-1.5 h-4 w-4" />
              Guardar Borrador
            </Button>
            
            {currentStep < 4 ? (
              <Button
                onClick={handleNext}
                className="bg-primary text-primary-foreground shadow-sm hover:shadow"
              >
                Siguiente
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={isSavingInProgress}
                className="bg-success text-success-foreground shadow-sm hover:shadow"
              >
                <Check className="mr-1.5 h-4 w-4" />
                Finalizar Cotización
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptimizedQuote;