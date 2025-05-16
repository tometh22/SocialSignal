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
  
  const handleFixedVersion = () => {
    setLocation(`/project-summary-fixed/${projectId}`);
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

      <div className="grid md:grid-cols-4 gap-4 max-w-6xl mx-auto">
        <Card className="border shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs md:text-sm">
              <Code className="h-3.5 w-3.5 text-primary" />
              Versión Original
            </CardTitle>
            <CardDescription className="text-[10px]">
              Dashboard inicial
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3">
            <div className="bg-slate-100 rounded-md p-3 mb-2 h-28 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <p className="text-[10px]">Vista básica inicial</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mb-3 h-16 overflow-auto">
              Versión original con problemas de superposición y visualización de componentes.
            </p>
            <Button onClick={handleOriginalVersion} size="sm" className="w-full h-7 text-xs">
              Ver Original
            </Button>
          </CardContent>
        </Card>

        <Card className="border shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs md:text-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              1ra Mejora
            </CardTitle>
            <CardDescription className="text-[10px]">
              Mejor estructura
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3">
            <div className="bg-slate-100 rounded-md p-3 mb-2 h-28 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <p className="text-[10px]">Jerarquía mejorada</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mb-3 h-16 overflow-auto">
              Primera mejora con mejor disposición pero mantiene algunos problemas de espaciado.
            </p>
            <Button onClick={handleImprovedVersion} size="sm" className="w-full h-7 text-xs">
              Ver 1ra Mejora
            </Button>
          </CardContent>
        </Card>
        
        <Card className="border shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs md:text-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              2da Mejora
            </CardTitle>
            <CardDescription className="text-[10px]">
              Organización en pestañas
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3">
            <div className="bg-slate-100 rounded-md p-3 mb-2 h-28 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <p className="text-[10px]">Diseño por secciones</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mb-3 h-16 overflow-auto">
              Versión con navegación por pestañas y mejor separación. Resuelve la mayor parte de los problemas.
            </p>
            <Button onClick={handleSuperVersion} size="sm" className="w-full h-7 text-xs">
              Ver 2da Mejora
            </Button>
          </CardContent>
        </Card>
        
        <Card className="border-2 shadow-md hover:shadow-lg transition-shadow border-primary/40 bg-primary/5">
          <CardHeader className="pb-2 bg-primary/10">
            <CardTitle className="flex items-center gap-2 text-xs md:text-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Versión Final
            </CardTitle>
            <CardDescription className="text-[10px]">
              Solución completa
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3">
            <div className="bg-slate-100 rounded-md p-3 mb-2 h-28 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <p className="text-[10px]">Diseño profesional</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mb-3 h-16 overflow-auto">
              Versión final perfeccionada. Espaciado óptimo, estructura clara, sin superposición de elementos. Con tooltips y mejor organización.
            </p>
            <Button onClick={handleFixedVersion} variant="default" size="sm" className="w-full h-7 text-xs relative overflow-hidden group">
              <span className="relative z-10">Ver Versión Final</span>
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