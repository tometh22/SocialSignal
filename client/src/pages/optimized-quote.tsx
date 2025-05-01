import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { OptimizedQuoteProvider, useOptimizedQuote } from '@/context/optimized-quote-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
    <div className="w-full min-h-screen">
      {/* Encabezado con título */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Nueva Cotización Optimizada</h1>
        <p className="text-sm text-slate-500">Crea una nueva cotización con nuestro flujo optimizado de 4 pasos.</p>
      </div>
      
      {/* Indicador de paso actual */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-blue-600 font-medium">
          Paso {currentStep} de 4: {
            currentStep === 1 ? "Información Básica" :
            currentStep === 2 ? "Selección de Plantilla" :
            currentStep === 3 ? "Configuración de Equipo" :
            "Revisión y Ajustes"
          }
        </div>
      </div>
      
      {/* Navegación de pasos */}
      <div className="flex space-x-1 mb-6">
        <div 
          className={`flex-1 py-2 text-center text-sm rounded-md border cursor-pointer transition-all
            ${currentStep === 1 
              ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium' 
              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          onClick={() => currentStep >= 1 && goToStep(1)}
        >
          1. Información
        </div>
        <div 
          className={`flex-1 py-2 text-center text-sm rounded-md border cursor-pointer transition-all
            ${currentStep === 2 
              ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium' 
              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          onClick={() => currentStep >= 2 && goToStep(2)}
        >
          2. Plantilla
        </div>
        <div 
          className={`flex-1 py-2 text-center text-sm rounded-md border cursor-pointer transition-all
            ${currentStep === 3 
              ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium' 
              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          onClick={() => currentStep >= 3 && goToStep(3)}
        >
          3. Equipo
        </div>
        <div 
          className={`flex-1 py-2 text-center text-sm rounded-md border cursor-pointer transition-all
            ${currentStep === 4 
              ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium' 
              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          onClick={() => currentStep >= 4 && goToStep(4)}
        >
          4. Revisión
        </div>
      </div>
      
      {/* Contenedor principal */}
      <div className="mb-20">
        {currentStep === 1 && <OptimizedBasicInfo />}
        {currentStep === 2 && <OptimizedTemplateSelection />}
        {currentStep === 3 && <OptimizedTeamConfig />}
        {currentStep === 4 && <OptimizedFinancialReview />}
      </div>
      
      {/* Botones de navegación (fijos en la parte inferior) */}
      <div className="fixed bottom-0 left-80 right-0 bg-white border-t border-slate-200 py-3 px-8 z-50 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between w-full">
          <Button
            variant="outline"
            onClick={previousStep}
            disabled={currentStep === 1}
            className="flex items-center"
          >
            <ChevronLeft className="mr-1.5 h-4 w-4" />
            Anterior
          </Button>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center"
            >
              <Save className="mr-1.5 h-4 w-4" />
              Guardar Borrador
            </Button>
            
            {currentStep < 4 ? (
              <Button
                onClick={handleNext}
                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white"
              >
                Siguiente
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white"
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