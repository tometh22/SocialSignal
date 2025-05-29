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
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ClientSummaryView from "@/components/dashboard/client-summary-view";

const ClientSummaryPage = () => {
  const [, params] = useRoute('/client-summary/:id');
  const clientId = params?.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  
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
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Resumen de Cliente</h1>
          <p className="text-muted-foreground">
            Análisis global de todos los proyectos de {clientName}
          </p>
        </div>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>

      <ClientSummaryView clientId={clientId} clientName={clientName} />
    </div>
  );
};

export default ClientSummaryPage;