import React, { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import ClientSummaryEnhanced from "@/components/dashboard/client-summary-enhanced";

const ClientSummaryPage = () => {
  const [, params] = useRoute('/client-summary/:id');
  const clientId = params?.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Obtener información del cliente
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}`],
    enabled: !!clientId,
  });

  if (!clientId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold mb-4">Cliente no especificado</h1>
        <p className="text-muted-foreground mb-6">Por favor, seleccione un cliente válido</p>
        <Button onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>
    );
  }

  if (clientLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="ml-2">Cargando información del cliente...</span>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold mb-4">Cliente no encontrado</h1>
        <p className="text-muted-foreground mb-6">No se encontró el cliente solicitado</p>
        <Button onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>
    );
  }

  // Extraer los datos del cliente con seguridad en TypeScript
  const clientName = client && typeof client === 'object' && 'name' in client 
    ? client.name as string 
    : "Cliente";

  return (
    <div className="page-container">
      {/* Breadcrumbs compactos */}
      <div className="breadcrumb-nav">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
          <span>Dashboard</span>
          <span>/</span>
          <span>Clientes</span>
          <span>/</span>
          <span className="text-foreground font-medium">{clientName}</span>
        </nav>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading-page">Resumen de Cliente: {clientName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => navigate(`/quarterly-nps/${clientId}`)}
              className="bg-green-600 hover:bg-green-700"
            >
              <FileText className="mr-2 h-4 w-4" />
              Encuesta NPS
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => navigate(`/quality-scores/${clientId}`)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Actualizar Puntuaciones
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
          </div>
        </div>
      </div>

      <ClientSummaryEnhanced clientId={clientId} clientName={clientName} />
    </div>
  );
};

export default ClientSummaryPage;