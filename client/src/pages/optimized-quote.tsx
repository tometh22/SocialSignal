import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { OptimizedQuoteProvider, useOptimizedQuote } from '@/context/optimized-quote-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Check, Save } from 'lucide-react';

// Importación de los componentes para cada paso
import OptimizedBasicInfo from '@/components/optimized/basic-info';
import { DirectComplexitySelection } from '@/components/optimized/minimal-complexity';
import OptimizedTemplateSelection from '@/components/optimized/template-selection';
import OptimizedTeamConfig from '@/components/optimized/team-config';
import OptimizedFinancialReview from '@/components/optimized/financial-review';

// Componente principal que contiene el flujo de cotización optimizado
const OptimizedQuote: React.FC = () => {
  return (
    <OptimizedQuoteProvider>
      <OptimizedQuoteContent />
    </OptimizedQuoteProvider>
  );
};

// Contenido principal del flujo optimizado
const OptimizedQuoteContent: React.FC = () => {
  const { 
    currentStep, 
    nextStep, 
    previousStep, 
    goToStep,
    saveQuotation,
    quotationData,
    updateTemplate
  } = useOptimizedQuote();
  
  const [isSaving, setIsSaving] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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
      // En este paso, ahora usamos la opción "DirectComplexitySelection" que establece template = null
      // y configura directamente los factores de complejidad, así que debemos aceptar siempre
      
      console.log("Paso 2: Factores de complejidad configurados directamente.");
      console.log("Análisis:", quotationData.analysisType);
      console.log("Menciones:", quotationData.mentionsVolume);
      console.log("Países:", quotationData.countriesCovered);
      console.log("Interacción:", quotationData.clientEngagement);
      console.log("Complejidad:", quotationData.complexity);
      
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

    setIsSaving(true);
    try {
      const quotationId = await saveQuotation();
      toast({
        title: "Cotización guardada",
        description: `La cotización se ha guardado correctamente con ID: ${quotationId}`,
      });
      
      // Redirigir a la página de detalle de la cotización en lugar del listado
      setLocation(`/quotation/${quotationId}`);
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

  // Tabs para mostrar los pasos del flujo
  return (
    <div className="flex flex-col bg-gray-50">
      {/* Encabezado con gradiente moderno (altura 48px) */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white h-12 flex items-center shadow-sm">
        <div className="max-w-[1440px] mx-auto w-full px-6">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-medium">Nueva Cotización</h1>
            <p className="text-blue-100 text-xs opacity-80">4 pasos</p>
          </div>
        </div>
      </div>
      
      <div className="px-6 py-8 flex-grow max-w-[1440px] mx-auto w-full">
        {/* Navegación de pasos mejorada (32px de separación) */}
        <div className="mb-8 flex justify-center">
          <Tabs 
            value={currentStep.toString()} 
            onValueChange={(value) => goToStep(parseInt(value))}
            className="w-full max-w-3xl"
          >
            <TabsList className="grid grid-cols-4 w-full h-10 bg-white p-0.5 rounded-md border border-gray-200 shadow-sm">
              <TabsTrigger 
                value="1" 
                disabled={currentStep < 1}
                className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 rounded transition-all text-sm h-9 min-w-[40px] min-h-[40px]"
              >
                <div className="flex items-center">
                  <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 font-medium">1</span>
                  <span className="text-sm">Información</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="2" 
                disabled={currentStep < 2}
                className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 rounded transition-all text-sm h-9 min-w-[40px] min-h-[40px]"
              >
                <div className="flex items-center">
                  <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 font-medium">2</span>
                  <span className="text-sm">Plantilla</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="3" 
                disabled={currentStep < 3}
                className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 rounded transition-all text-sm h-9 min-w-[40px] min-h-[40px]"
              >
                <div className="flex items-center">
                  <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 font-medium">3</span>
                  <span className="text-sm">Equipo</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="4" 
                disabled={currentStep < 4}
                className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 rounded transition-all text-sm h-9 min-w-[40px] min-h-[40px]"
              >
                <div className="flex items-center">
                  <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 font-medium">4</span>
                  <span className="text-sm">Revisión</span>
                </div>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {/* Contenedor principal con estilos modernos - con padding de 16px */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-[88px] overflow-visible">
          {currentStep === 1 && <OptimizedBasicInfo />}
          {currentStep === 2 && <OptimizedTemplateSelection />}
          {currentStep === 3 && <OptimizedTeamConfig />}
          {currentStep === 4 && <OptimizedFinancialReview />}
        </div>
        
        {/* Tarjetas de ayuda con estilo moderno y compacto - min-height 96px para cards */}
        {currentStep === 1 && (
          <div className="flex justify-between gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-100 rounded-lg shadow-sm overflow-hidden min-h-[96px] w-1/3 transition-all hover:shadow-md">
              <div className="flex items-center p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <h3 className="text-blue-700 text-sm font-medium">Consejo</h3>
              </div>
              <div className="px-4 pb-4">
                <p className="text-sm text-blue-900 line-height-1.5">
                  Al seleccionar el tipo de proyecto, considera el alcance y objetivos para una cotización precisa.
                </p>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-100 rounded-lg shadow-sm overflow-hidden min-h-[96px] w-1/3 transition-all hover:shadow-md">
              <div className="flex items-center p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                </svg>
                <h3 className="text-blue-700 text-sm font-medium">Recomendación</h3>
              </div>
              <div className="px-4 pb-4">
                <p className="text-sm text-blue-900 line-height-1.5">
                  Para proyectos de media o larga duración, incluye al menos un experto en análisis de datos.
                </p>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-100 rounded-lg shadow-sm overflow-hidden min-h-[96px] w-1/3 transition-all hover:shadow-md">
              <div className="flex items-center p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                <h3 className="text-blue-700 text-sm font-medium">Plantillas populares</h3>
              </div>
              <div className="px-4 pb-4">
                <p className="text-sm text-blue-900 line-height-1.5">
                  Las plantillas más utilizadas son "Informe Ejecutivo" y "Análisis de Tendencias".
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Botones de navegación (fijos en la parte inferior) - con 16px de padding y min 44px de altura */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-4 px-6 z-50 shadow-sm">
        <div className="max-w-[1440px] mx-auto flex justify-between w-full">
          <Button
            variant="ghost"
            onClick={previousStep}
            disabled={currentStep === 1}
            className="text-sm h-11 min-w-[120px]"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Anterior
          </Button>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={isSaving}
              className="text-sm h-11 min-w-[120px]"
            >
              <Save className="mr-2 h-4 w-4" />
              Guardar
            </Button>
            
            {currentStep < 4 ? (
              <Button
                onClick={handleNext}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm h-11 min-w-[120px]"
              >
                Siguiente
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 text-white text-sm h-11 min-w-[120px]"
              >
                <Check className="mr-2 h-4 w-4" />
                Finalizar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptimizedQuote;