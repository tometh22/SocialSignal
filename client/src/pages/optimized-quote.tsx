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
    <div className="flex flex-col bg-gray-50 pb-20">
      {/* Encabezado con gradiente moderno (más compacto) */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-5 py-3 shadow-md">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-semibold">Nueva Cotización Optimizada</h1>
          <p className="text-blue-100 text-xs mt-1">Crea una nueva cotización con nuestro flujo optimizado de 4 pasos.</p>
        </div>
      </div>
      
      <div className="px-5 py-4 flex-grow max-w-7xl mx-auto w-full">
        {/* Navegación de pasos mejorada (más compacta) */}
        <div className="mb-4 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
          <Tabs 
            value={currentStep.toString()} 
            onValueChange={(value) => goToStep(parseInt(value))}
            className="w-full"
          >
            <TabsList className="grid grid-cols-4 w-full h-10 bg-slate-50 p-1 rounded">
              <TabsTrigger 
                value="1" 
                disabled={currentStep < 1}
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 rounded-md transition-all text-xs"
              >
                <div className="flex flex-col items-center">
                  <span className="text-xs font-medium">Paso 1</span>
                  <span className="text-[10px] mt-0.5">Información Básica</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="2" 
                disabled={currentStep < 2}
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 rounded-md transition-all text-xs"
              >
                <div className="flex flex-col items-center">
                  <span className="text-xs font-medium">Paso 2</span>
                  <span className="text-[10px] mt-0.5">Selección de Plantilla</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="3" 
                disabled={currentStep < 3}
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 rounded-md transition-all text-xs"
              >
                <div className="flex flex-col items-center">
                  <span className="text-xs font-medium">Paso 3</span>
                  <span className="text-[10px] mt-0.5">Configuración de Equipo</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="4" 
                disabled={currentStep < 4}
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 rounded-md transition-all text-xs"
              >
                <div className="flex flex-col items-center">
                  <span className="text-xs font-medium">Paso 4</span>
                  <span className="text-[10px] mt-0.5">Revisión y Ajustes</span>
                </div>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {/* Contenedor principal simplificado */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-[120px] overflow-visible">
          {currentStep === 1 && <OptimizedBasicInfo />}
          {currentStep === 2 && <OptimizedTemplateSelection />}
          {currentStep === 3 && <OptimizedTeamConfig />}
          {currentStep === 4 && <OptimizedFinancialReview />}
        </div>
        
        {/* Nueva sección de ayuda y consejos - Reducida de tamaño */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
            <div className="bg-blue-50 border border-blue-100 rounded-lg shadow-sm overflow-hidden">
              <div className="flex flex-col space-y-1 p-3">
                <h3 className="text-blue-700 text-sm flex items-center font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  Consejo
                </h3>
              </div>
              <div className="p-3 pt-0">
                <p className="text-xs text-blue-900">
                  Al seleccionar el tipo de proyecto, considera el alcance y objetivos para una cotización más precisa.
                </p>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-100 rounded-lg shadow-sm overflow-hidden">
              <div className="flex flex-col space-y-1 p-3">
                <h3 className="text-blue-700 text-sm flex items-center font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                  </svg>
                  Recomendación
                </h3>
              </div>
              <div className="p-3 pt-0">
                <p className="text-xs text-blue-900">
                  Para proyectos de media o larga duración, te recomendamos incluir al menos un experto en análisis de datos.
                </p>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-100 rounded-lg shadow-sm overflow-hidden">
              <div className="flex flex-col space-y-1 p-3">
                <h3 className="text-blue-700 text-sm flex items-center font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                  Plantillas populares
                </h3>
              </div>
              <div className="p-3 pt-0">
                <p className="text-xs text-blue-900">
                  Las plantillas más utilizadas para este tipo de proyectos son "Informe Ejecutivo" y "Análisis de Tendencias".
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Botones de navegación (fijos en la parte inferior) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-3 px-5 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={previousStep}
            disabled={currentStep === 1}
            className="flex items-center transition-all hover:bg-slate-100"
          >
            <ChevronLeft className="mr-1 h-3 w-3" />
            Anterior
          </Button>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center transition-all hover:bg-slate-100"
            >
              <Save className="mr-1 h-3 w-3" />
              Guardar Borrador
            </Button>
            
            {currentStep < 4 ? (
              <Button
                size="sm"
                onClick={handleNext}
                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-3 transition-all"
              >
                Siguiente
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center bg-green-600 hover:bg-green-700 text-white px-3 transition-all"
              >
                <Check className="mr-1 h-3 w-3" />
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