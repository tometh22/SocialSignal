import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ClientSummarySimpleProps {
  clientId: number;
  clientName: string;
}

const ClientSummarySimple: React.FC<ClientSummarySimpleProps> = ({ clientId, clientName }) => {
  // Obtener datos directamente sin validación estricta
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/modo-summary`],
    retry: false,
  });

  const { data: deliverablesData, isLoading: deliverablesLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/deliverables`],
    retry: false,
  });

  console.log('Simple Debug:', { summaryData, deliverablesData, summaryLoading, deliverablesLoading });

  const isLoading = summaryLoading || deliverablesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="ml-2">Cargando datos del cliente...</span>
      </div>
    );
  }

  // Mostrar datos básicos sin validación compleja
  const summary = summaryData || {};
  const deliverables = Array.isArray(deliverablesData) ? deliverablesData : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Resumen del Cliente: {clientName}</CardTitle>
          <CardDescription>
            Análisis global de todos los proyectos del cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Entregables Totales */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Entregables Totales</p>
              <p className="text-2xl font-bold">{summary.totalDeliverables || 0}</p>
            </div>

            {/* Entregas a Tiempo */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Entregas a Tiempo</p>
              <p className="text-2xl font-bold">{summary.onTimeDeliveries || 0}</p>
              <p className="text-xs text-gray-500">
                {summary.onTimePercentage ? `${Math.round(summary.onTimePercentage)}%` : '0%'}
              </p>
            </div>

            {/* Puntuación Promedio */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Puntuación Promedio</p>
              <p className="text-2xl font-bold">
                {summary.averageScores ? 
                  (Object.values(summary.averageScores).reduce((a, b) => a + b, 0) / 
                   Object.values(summary.averageScores).length).toFixed(1) : 
                  '0.0'}
              </p>
              <p className="text-xs text-gray-500">sobre 5.0</p>
            </div>

            {/* Comentarios */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Comentarios</p>
              <p className="text-2xl font-bold">{summary.totalComments || 0}</p>
            </div>
          </div>

          {/* Progreso visual */}
          <div className="mt-6 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Puntualidad</span>
                <span>{summary.onTimePercentage ? `${Math.round(summary.onTimePercentage)}%` : '0%'}</span>
              </div>
              <Progress value={summary.onTimePercentage || 0} className="h-2" />
            </div>

            {summary.averageHours && (
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Cumplimiento de Horas</span>
                  <span>{Math.round((summary.averageHours.compliance || 0) * 100)}%</span>
                </div>
                <Progress value={(summary.averageHours.compliance || 0) * 100} className="h-2" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de entregables recientes */}
      {deliverables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Entregables Recientes</CardTitle>
            <CardDescription>
              Últimos {Math.min(deliverables.length, 5)} entregables del cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deliverables.slice(0, 5).map((deliverable, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{deliverable.title || `Entregable ${index + 1}`}</p>
                    <p className="text-sm text-gray-500">
                      Proyecto: {deliverable.project_name || `ID ${deliverable.project_id}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 text-xs rounded ${
                      deliverable.on_time ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {deliverable.on_time ? 'A tiempo' : 'Tardío'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug info */}
      <Card>
        <CardHeader>
          <CardTitle>Información de Depuración</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify({ summary, deliverables: deliverables.length }, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientSummarySimple;