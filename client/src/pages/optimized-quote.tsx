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
    <div className="w-full min-h-screen flex flex-col">
      {/* Encabezado con título y progreso */}
      <div className="bg-white border-b border-slate-200 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Nueva Cotización Optimizada</h1>
              <p className="text-sm text-slate-500">Crea una nueva cotización con nuestro flujo optimizado de 4 pasos.</p>
            </div>
            <div className="text-sm text-blue-600 font-medium bg-blue-50 px-3 py-1 rounded-md border border-blue-100 flex items-center">
              Paso {currentStep} de 4: {
                currentStep === 1 ? "Información Básica" :
                currentStep === 2 ? "Selección de Plantilla" :
                currentStep === 3 ? "Configuración de Equipo" :
                "Revisión y Ajustes"
              }
            </div>
          </div>
          
          {/* Barra de progreso */}
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-600 to-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            ></div>
          </div>
          
          {/* Pasos como pills */}
          <div className="flex justify-between mt-2">
            <div 
              className={`px-3 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all
                ${currentStep >= 1 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              onClick={() => currentStep >= 1 && goToStep(1)}
            >
              1. Información
            </div>
            <div 
              className={`px-3 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all
                ${currentStep >= 2 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              onClick={() => currentStep >= 2 && goToStep(2)}
            >
              2. Plantilla
            </div>
            <div 
              className={`px-3 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all
                ${currentStep >= 3 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              onClick={() => currentStep >= 3 && goToStep(3)}
            >
              3. Equipo
            </div>
            <div 
              className={`px-3 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all
                ${currentStep >= 4 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              onClick={() => currentStep >= 4 && goToStep(4)}
            >
              4. Revisión
            </div>
          </div>
        </div>
      </div>
      
      {/* Contenedor principal */}
      <div className="flex-grow bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <Card className="border-0 shadow">
            <div className="p-6">
              {currentStep === 1 && <OptimizedBasicInfo />}
              {currentStep === 2 && <OptimizedTemplateSelection />}
              {currentStep === 3 && <OptimizedTeamConfig />}
              {currentStep === 4 && <OptimizedFinancialReview />}
            </div>
          </Card>
        </div>
      </div>
      
      {/* Botones de navegación (fijos en la parte inferior) */}
      <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-3 px-6 z-50 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between w-full">
          <Button
            variant="outline"
            onClick={previousStep}
            disabled={currentStep === 1}
            className="flex items-center border-slate-300 hover:bg-slate-100 hover:text-slate-800 transition-all"
          >
            <ChevronLeft className="mr-1.5 h-4 w-4" />
            Anterior
          </Button>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center border-slate-300 hover:bg-slate-100 hover:text-slate-800 transition-all"
            >
              <Save className="mr-1.5 h-4 w-4" />
              Guardar Borrador
            </Button>
            
            {currentStep < 4 ? (
              <Button
                onClick={handleNext}
                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 transition-all"
              >
                Siguiente
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 transition-all"
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