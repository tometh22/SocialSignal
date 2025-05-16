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

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <Card className="border shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" />
              Versión Original
            </CardTitle>
            <CardDescription>
              El dashboard de resumen de proyecto en su versión inicial
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-100 rounded-md p-4 mb-4 h-48 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <p className="text-sm">Vista previa no disponible</p>
                <p className="text-xs">Visualización básica con disposición original</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              La versión original incluye los datos principales del proyecto pero con una disposición visual que puede dificultar el análisis efectivo.
            </p>
            <Button onClick={handleOriginalVersion} className="w-full">
              Ver Versión Original
            </Button>
          </CardContent>
        </Card>

        <Card className="border shadow-md hover:shadow-lg transition-shadow border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5 text-primary" />
              Versión Mejorada
            </CardTitle>
            <CardDescription>
              Diseño optimizado para mejor visualización y análisis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-100 rounded-md p-4 mb-4 h-48 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <p className="text-sm">Vista previa no disponible</p>
                <p className="text-xs">Diseño mejorado con jerarquía visual clara</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              La versión mejorada presenta una jerarquía visual clara, mejor espaciado de componentes, colores consistentes y una organización más intuitiva para un análisis eficiente.
            </p>
            <Button onClick={handleImprovedVersion} variant="default" className="w-full">
              Ver Versión Mejorada
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