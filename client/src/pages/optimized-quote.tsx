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
    <div className="flex flex-col">
      {/* Header global que va con la clase header */}
      <div className="header bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center">
        <div className="max-w-[1440px] mx-auto w-full px-6 ml-[280px]">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-medium">Nueva Cotización</h1>
            <p className="text-blue-100 text-xs opacity-80">4 pasos</p>
          </div>
        </div>
      </div>
      
      <div className="px-6 py-8 flex-grow max-w-[1440px] mx-auto w-full">
        {/* Breadcrumb para mejor orientación */}
        <div className="flex items-center mb-4 text-sm">
          <a href="#" className="text-gray-500 hover:text-blue-600 transition-colors">Cotizaciones</a>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mx-2 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          <span className="text-blue-600 font-medium">Nueva Cotización</span>
        </div>
        
        {/* Navegación de pasos como progress bar - máximo 48px de altura */}
        <div className="mb-8 flex justify-center">
          <div className="w-full max-w-3xl">
            <div className="step-progress flex justify-between">
              {/* Paso 1 */}
              <div className="flex flex-col items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium mb-1 ${
                    currentStep >= 1 ? 'bg-[#2F80ED] text-white' : 'bg-[#E0E0E0] text-[#666666]'
                  }`}
                  onClick={() => currentStep >= 1 && goToStep(1)}
                >
                  1
                </div>
                <span className={`text-xs ${currentStep === 1 ? 'step-label active' : 'step-label'}`}>
                  Información
                </span>
              </div>

              {/* Barra de progreso 1-2 */}
              <div className="flex-1 flex items-center mx-2">
                <div className={`step-progress-bar ${currentStep >= 2 ? 'active' : ''}`}></div>
              </div>

              {/* Paso 2 */}
              <div className="flex flex-col items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium mb-1 ${
                    currentStep >= 2 ? 'bg-[#2F80ED] text-white' : 'bg-[#E0E0E0] text-[#666666]'
                  }`}
                  onClick={() => currentStep >= 2 && goToStep(2)}
                >
                  2
                </div>
                <span className={`text-xs ${currentStep === 2 ? 'step-label active' : 'step-label'}`}>
                  Plantilla
                </span>
              </div>

              {/* Barra de progreso 2-3 */}
              <div className="flex-1 flex items-center mx-2">
                <div className={`step-progress-bar ${currentStep >= 3 ? 'active' : ''}`}></div>
              </div>

              {/* Paso 3 */}
              <div className="flex flex-col items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium mb-1 ${
                    currentStep >= 3 ? 'bg-[#2F80ED] text-white' : 'bg-[#E0E0E0] text-[#666666]'
                  }`}
                  onClick={() => currentStep >= 3 && goToStep(3)}
                >
                  3
                </div>
                <span className={`text-xs ${currentStep === 3 ? 'step-label active' : 'step-label'}`}>
                  Equipo
                </span>
              </div>

              {/* Barra de progreso 3-4 */}
              <div className="flex-1 flex items-center mx-2">
                <div className={`step-progress-bar ${currentStep >= 4 ? 'active' : ''}`}></div>
              </div>

              {/* Paso 4 */}
              <div className="flex flex-col items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium mb-1 ${
                    currentStep >= 4 ? 'bg-[#2F80ED] text-white' : 'bg-[#E0E0E0] text-[#666666]'
                  }`}
                  onClick={() => currentStep >= 4 && goToStep(4)}
                >
                  4
                </div>
                <span className={`text-xs ${currentStep === 4 ? 'step-label active' : 'step-label'}`}>
                  Revisión
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Contenedor principal con estilos modernos - con padding de 16px */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-[88px] overflow-visible">
          {currentStep === 1 && <OptimizedBasicInfo />}
          {currentStep === 2 && <OptimizedTemplateSelection />}
          {currentStep === 3 && <OptimizedTeamConfig />}
          {currentStep === 4 && <OptimizedFinancialReview />}
        </div>
        
        {/* Tarjetas de ayuda mejoradas según especificaciones */}
        {currentStep === 1 && (
          <div className="advice-cards flex justify-between gap-4 mb-8 mt-10 wizard-step-transition">
            <div className="advice-card bg-white rounded-lg overflow-hidden flex-1 flex-1-0 max-w-[400px] card-hover">
              <div className="flex h-full">
                <div className="w-1 bg-[#F0F4FF]"></div> {/* Borde izquierdo azul muy sutil */}
                <div className="p-4 flex-1 flex items-center">
                  <div>
                    <div className="flex items-center mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-[#2F80ED]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                      </svg>
                      <h3 className="subtitle">Consejo</h3>
                    </div>
                    <p className="body-text">
                      Al seleccionar el tipo de proyecto, considera el alcance y objetivos para una cotización precisa.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="advice-card bg-white rounded-lg overflow-hidden flex-1 flex-1-0 max-w-[400px] card-hover">
              <div className="flex h-full">
                <div className="w-1 bg-[#F0F4FF]"></div> {/* Borde izquierdo azul muy sutil */}
                <div className="p-4 flex-1 flex items-center">
                  <div>
                    <div className="flex items-center mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-[#2F80ED]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                      </svg>
                      <h3 className="subtitle">Recomendación</h3>
                    </div>
                    <p className="body-text">
                      Para proyectos de media o larga duración, incluye al menos un experto en análisis de datos.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="advice-card bg-white rounded-lg overflow-hidden flex-1 flex-1-0 max-w-[400px] card-hover">
              <div className="flex h-full">
                <div className="w-1 bg-[#F0F4FF]"></div> {/* Borde izquierdo azul muy sutil */}
                <div className="p-4 flex-1 flex items-center">
                  <div>
                    <div className="flex items-center mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-[#2F80ED]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>
                      <h3 className="subtitle">Plantillas populares</h3>
                    </div>
                    <p className="body-text">
                      Las plantillas más utilizadas son "Informe Ejecutivo" y "Análisis de Tendencias".
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer exactamente de 64px de altura según especificaciones */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 py-0 px-6 z-50 shadow-sm">
        <div className="max-w-[1440px] mx-auto flex justify-end w-full h-full">
          <div className="flex items-center h-full">
            <Button
              variant="ghost"
              onClick={previousStep}
              disabled={currentStep === 1}
              className="text-sm h-10 min-w-[120px] mr-4"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Anterior
            </Button>
            
            <div className="flex gap-4 mr-6">
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={isSaving}
                className="text-sm h-10 min-w-[120px]"
              >
                <Save className="mr-2 h-4 w-4" />
                Guardar
              </Button>
              
              {currentStep < 4 ? (
                <Button
                  onClick={handleNext}
                  className="bg-[#2F80ED] hover:bg-[#1D6FE0] text-white text-sm h-10 min-w-[120px] transition-colors duration-150"
                >
                  Siguiente
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm h-10 min-w-[120px] transition-colors duration-150"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Finalizar
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptimizedQuote;