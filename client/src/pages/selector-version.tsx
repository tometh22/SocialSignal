import React from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sparkles, Code } from "lucide-react";

const VersionSelector = () => {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();

  const handleOriginalVersion = () => {
    setLocation(`/project-summary/${projectId}`);
  };

  const handleImprovedVersion = () => {
    setLocation(`/project-summary-new/${projectId}`);
  };
  
  const handleSuperVersion = () => {
    setLocation(`/project-summary-super/${projectId}`);
  };

  const handleBack = () => {
    setLocation("/active-projects");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="outline" onClick={handleBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Volver a Proyectos
        </Button>
      </div>

      <h1 className="text-3xl font-bold mb-6 text-center">Selecciona la Versión del Resumen de Proyecto</h1>
      <p className="text-center text-muted-foreground mb-8">
        Elige entre la versión original o la versión mejorada con visualización de datos optimizada
      </p>

      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        <Card className="border shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm md:text-base">
              <Code className="h-4 w-4 text-primary" />
              Versión Original
            </CardTitle>
            <CardDescription className="text-xs">
              Dashboard con la disposición inicial
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-100 rounded-md p-4 mb-4 h-36 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <p className="text-xs">Vista previa no disponible</p>
                <p className="text-[10px]">Visualización básica inicial</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4 h-24 overflow-auto">
              La versión original incluye los datos principales del proyecto pero con problemas de superposición y jerarquía visual que dificultan el análisis efectivo.
            </p>
            <Button onClick={handleOriginalVersion} size="sm" className="w-full">
              Ver Versión Original
            </Button>
          </CardContent>
        </Card>

        <Card className="border shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm md:text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Versión Mejorada
            </CardTitle>
            <CardDescription className="text-xs">
              Primera mejora de diseño y estructura
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-100 rounded-md p-4 mb-4 h-36 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <p className="text-xs">Vista previa no disponible</p>
                <p className="text-[10px]">Diseño mejorado con mejor jerarquía</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4 h-24 overflow-auto">
              Esta versión mejorada presenta mejor disposición de componentes, esquema visual más claro y distribución más intuitiva. Resuelve parcialmente los problemas de diseño.
            </p>
            <Button onClick={handleImprovedVersion} size="sm" className="w-full">
              Ver Primera Versión Mejorada
            </Button>
          </CardContent>
        </Card>
        
        <Card className="border-2 shadow-md hover:shadow-lg transition-shadow border-primary/40 bg-primary/5">
          <CardHeader className="pb-3 bg-primary/10">
            <CardTitle className="flex items-center gap-2 text-sm md:text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Versión Optimizada
            </CardTitle>
            <CardDescription className="text-xs">
              Solución completa a problemas visuales
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-100 rounded-md p-4 mb-4 h-36 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <p className="text-xs">Vista previa no disponible</p>
                <p className="text-[10px]">Diseño completamente rediseñado</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4 h-24 overflow-auto">
              Versión totalmente renovada con una interfaz tipo "dashboard profesional". Utiliza pestañas para separar claramente las secciones, mejora el espaciado y elimina completamente las superposiciones. Incluye tooltips y mejor organización visual.
            </p>
            <Button onClick={handleSuperVersion} variant="default" size="sm" className="w-full relative overflow-hidden group">
              <span className="relative z-10">Ver Versión Optimizada</span>
              <span className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-12 max-w-2xl mx-auto">
        <Card className="border border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium text-blue-800 mb-2">Mejoras principales en la versión optimizada:</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex gap-2">
                <span className="font-bold">✓</span>
                <span>Jerarquía visual mejorada con clara distinción entre componentes principales y secundarios</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">✓</span>
                <span>Organización por tabs para acceso rápido a diferentes secciones sin recarga</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">✓</span>
                <span>Sistema de color consistente para facilitar el reconocimiento de métricas y alertas</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">✓</span>
                <span>Diseño responsive que mantiene la integridad visual en dispositivos móviles</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">✓</span>
                <span>Espaciado optimizado entre componentes para evitar superposiciones</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VersionSelector;