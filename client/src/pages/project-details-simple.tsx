import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProjectDetailsSimple() {
  const { id: projectId } = useParams();
  const [, setLocation] = useLocation();

  // Datos del proyecto
  const { data: project, isLoading } = useQuery({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-slate-600">Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  const projectData = project as any;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header simple */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/active-projects')}
              className="text-slate-600 hover:text-slate-800"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {projectData?.name || 'Proyecto'}
              </h1>
              <p className="text-slate-600">
                Cliente: {projectData?.clientName || 'Sin cliente'}
              </p>
            </div>
          </div>
        </div>

        {/* Contenido principal */}
        <Card>
          <CardHeader>
            <CardTitle>Detalles del Proyecto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-slate-600">Nombre</p>
                <p className="text-slate-800">{projectData?.name || 'Sin nombre'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Estado</p>
                <p className="text-slate-800">{projectData?.status || 'Sin estado'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Presupuesto</p>
                <p className="text-slate-800">${(projectData?.budget || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Fecha de inicio</p>
                <p className="text-slate-800">
                  {projectData?.startDate ? new Date(projectData.startDate).toLocaleDateString() : 'Sin fecha'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}