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
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center h-16 px-4 border-b border-neutral-200 bg-white">
        <h2 className="text-subheading text-neutral-900">Nueva Cotización Optimizada</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="container-xl fade-in">
          <div className="section-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-section">
              <h1 className="text-display text-balance text-neutral-900 slide-in">Crea una Nueva Cotización</h1>
            </div>
            
            {/* Navegación de pasos mejorada */}
            <Card className="glass-card shadow-medium mb-8 scale-in">
              <CardHeader className="pb-3 border-b border-white/10">
                <CardTitle className="text-heading flex items-center">
                  <span className="bg-primary/20 p-2 rounded-full mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                  </span>
                  Pasos de Cotización
                </CardTitle>
                <CardDescription>
                  Sigue estos 4 pasos para crear una cotización completa y precisa
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <Tabs 
                  value={currentStep.toString()} 
                  onValueChange={(value) => goToStep(parseInt(value))}
                  className="w-full"
                >
                  <TabsList className="grid grid-cols-4 w-full bg-slate-100/50 p-1 rounded-lg">
                    <TabsTrigger 
                      value="1" 
                      disabled={currentStep < 1}
                      className="hover-lift data-[state=active]:glass-pill data-[state=active]:shadow-medium rounded-md transition-all text-sm"
                    >
                      <div className="flex flex-col items-center py-2">
                        <span className="text-sm font-medium">Paso 1</span>
                        <span className="text-xs mt-1">Información Básica</span>
                      </div>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="2" 
                      disabled={currentStep < 2}
                      className="hover-lift data-[state=active]:glass-pill data-[state=active]:shadow-medium rounded-md transition-all text-sm"
                    >
                      <div className="flex flex-col items-center py-2">
                        <span className="text-sm font-medium">Paso 2</span>
                        <span className="text-xs mt-1">Selección de Plantilla</span>
                      </div>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="3" 
                      disabled={currentStep < 3}
                      className="hover-lift data-[state=active]:glass-pill data-[state=active]:shadow-medium rounded-md transition-all text-sm"
                    >
                      <div className="flex flex-col items-center py-2">
                        <span className="text-sm font-medium">Paso 3</span>
                        <span className="text-xs mt-1">Configuración de Equipo</span>
                      </div>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="4" 
                      disabled={currentStep < 4}
                      className="hover-lift data-[state=active]:glass-pill data-[state=active]:shadow-medium rounded-md transition-all text-sm"
                    >
                      <div className="flex flex-col items-center py-2">
                        <span className="text-sm font-medium">Paso 4</span>
                        <span className="text-xs mt-1">Revisión y Ajustes</span>
                      </div>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>
            
            {/* Contenedor principal con efecto de glass */}
            <Card className="glass-card shadow-medium mb-10 scale-in">
              <CardContent className="p-6 overflow-visible">
                {currentStep === 1 && <OptimizedBasicInfo />}
                {currentStep === 2 && <OptimizedTemplateSelection />}
                {currentStep === 3 && <OptimizedTeamConfig />}
                {currentStep === 4 && <OptimizedFinancialReview />}
              </CardContent>
            </Card>
            
            {/* Sección de ayuda y consejos - Estilo moderno acorde al resto de la aplicación */}
            {currentStep === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10 fade-in">
                <Card className="glass-pill shadow-medium hover-lift">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-heading flex items-center text-base">
                      <span className="bg-primary/10 p-2 rounded-full mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="16" x2="12" y2="12"></line>
                          <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                      </span>
                      Consejo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-neutral-700">
                      Al seleccionar el tipo de proyecto, considera el alcance y objetivos para una cotización más precisa.
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="glass-pill shadow-medium hover-lift">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-heading flex items-center text-base">
                      <span className="bg-accent/10 p-2 rounded-full mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                        </svg>
                      </span>
                      Recomendación
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-neutral-700">
                      Para proyectos de media o larga duración, te recomendamos incluir al menos un experto en análisis de datos.
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="glass-pill shadow-medium hover-lift">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-heading flex items-center text-base">
                      <span className="bg-success/10 p-2 rounded-full mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                      </span>
                      Plantillas populares
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-neutral-700">
                      Las plantillas más utilizadas para este tipo de proyectos son "Informe Ejecutivo" y "Análisis de Tendencias".
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Botones de navegación (fijos en la parte inferior) */}
      <div className="fixed bottom-0 left-0 right-0 glass-navbar backdrop-blur-sm py-3 px-5 z-50 shadow-deep border-t border-white/10">
        <div className="container-xl mx-auto flex justify-between items-center w-full">
          <Button
            variant="ghost"
            onClick={previousStep}
            disabled={currentStep === 1}
            className="flex items-center hover-lift transition-all"
          >
            <ChevronLeft className="mr-1.5 h-4 w-4" />
            Anterior
          </Button>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={isSaving}
              className="glass-button shadow-medium hover-lift transition-all"
            >
              <Save className="mr-1.5 h-4 w-4" />
              Guardar Borrador
            </Button>
            
            {currentStep < 4 ? (
              <Button
                onClick={handleNext}
                className="glass-button-primary shadow-medium hover-lift transition-all"
              >
                Siguiente
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="glass-button-success shadow-medium hover-lift transition-all"
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