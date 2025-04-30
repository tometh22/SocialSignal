import React from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { Client } from '@shared/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { queryClient } from '@/lib/queryClient';

const OptimizedBasicInfo: React.FC = () => {
  const {
    quotationData,
    updateClient,
    updateProjectName,
    updateProjectType,
    updateProjectDuration
  } = useOptimizedQuote();

  // Consultar lista de clientes
  const { data: clients, isLoading: isLoadingClients, isError: isClientsError } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    staleTime: 5000, // 5 segundos
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 5000),
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchInterval: false,
  });

  // Consultar tipos de proyecto
  const { data: projectTypes, isLoading: isLoadingProjectTypes } = useQuery<{value: string, label: string}[]>({
    queryKey: ['/api/options/project-types'],
    staleTime: 30000,
    retry: 3,
  });
  
  // Botón para forzar la recarga de datos
  const handleRefreshClients = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
  }, []);
  
  // Efecto para cargar datos automáticamente al montar
  React.useEffect(() => {
    // Forzar carga inicial si es necesario
    if (!clients && !isLoadingClients) {
      console.log("Forzando carga de clientes...");
      handleRefreshClients();
    }
    
    // Si hay error, reintentar automáticamente después de 2 segundos
    if (isClientsError) {
      const timer = setTimeout(() => {
        console.log("Reintentando cargar clientes después de error...");
        handleRefreshClients();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [clients, isLoadingClients, isClientsError, handleRefreshClients]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="mb-2">
        <h2 className="text-lg font-semibold">Información Básica</h2>
        <p className="text-sm text-neutral-500">
          Ingresa la información básica para comenzar la cotización.
        </p>
      </div>

      {/* Cliente */}
      <div className="space-y-3">
        <Label htmlFor="client">Cliente <span className="text-red-500">*</span></Label>
        {isLoadingClients ? (
          <div className="py-2 px-4 border rounded-md flex items-center space-x-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <span>Cargando clientes...</span>
          </div>
        ) : isClientsError ? (
          <div className="py-2 px-4 border border-red-200 bg-red-50 rounded-md flex items-center space-x-2 text-sm text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>Error al cargar clientes. 
              <button 
                onClick={handleRefreshClients} 
                className="underline ml-1 font-medium"
              >
                Reintentar
              </button>
            </span>
          </div>
        ) : (
          <Select
            value={quotationData.client ? String(quotationData.client.id) : ''}
            onValueChange={(value) => {
              const selectedClient = clients?.find(client => client.id === parseInt(value));
              updateClient(selectedClient || null);
            }}
          >
            <SelectTrigger id="client" className="w-full">
              <SelectValue placeholder="Seleccionar cliente" />
            </SelectTrigger>
            <SelectContent>
              {clients && clients.length > 0 ? (
                clients.map((client) => (
                  <SelectItem key={client.id} value={String(client.id)}>
                    {client.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-clients" disabled>No hay clientes disponibles</SelectItem>
              )}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center justify-between text-xs mt-1">
          <a href="/clients/new" target="_blank" className="text-blue-600 hover:underline">
            + Crear nuevo cliente
          </a>
          {!isLoadingClients && (
            <button 
              type="button" 
              onClick={handleRefreshClients}
              className="text-gray-500 hover:text-blue-600 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar lista
            </button>
          )}
        </div>
      </div>

      {/* Nombre del Proyecto */}
      <div className="space-y-3">
        <Label htmlFor="project-name">Nombre del Proyecto <span className="text-red-500">*</span></Label>
        <Input
          id="project-name"
          placeholder="Ej. Análisis de Mercado Q2 2023"
          value={quotationData.project.name}
          onChange={(e) => updateProjectName(e.target.value)}
        />
      </div>

      {/* Tipo de Proyecto */}
      <div className="space-y-3">
        <Label htmlFor="project-type">Tipo de Proyecto</Label>
        <Select
          value={quotationData.project.type}
          onValueChange={updateProjectType}
          disabled={isLoadingProjectTypes}
        >
          <SelectTrigger id="project-type">
            <SelectValue placeholder="Seleccionar tipo" />
          </SelectTrigger>
          <SelectContent>
            {projectTypes?.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Duración del Proyecto */}
      <div className="space-y-3">
        <Label htmlFor="project-duration">Duración del Proyecto</Label>
        <Select
          value={quotationData.project.duration}
          onValueChange={(value) => updateProjectDuration(value as any)}
        >
          <SelectTrigger id="project-duration">
            <SelectValue placeholder="Seleccionar duración" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="short">Corto (1-3 meses)</SelectItem>
            <SelectItem value="medium">Medio (3-6 meses)</SelectItem>
            <SelectItem value="long">Largo (6+ meses)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Información del cliente seleccionado */}
      {quotationData.client && (
        <Card className="mt-6 bg-slate-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-md">Información del Cliente</CardTitle>
            <CardDescription>Detalles del cliente seleccionado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-neutral-700">Nombre:</p>
                <p>{quotationData.client.name}</p>
              </div>
              {quotationData.client.contactName && (
                <div>
                  <p className="font-medium text-neutral-700">Contacto:</p>
                  <p>{quotationData.client.contactName}</p>
                </div>
              )}
              {quotationData.client.contactEmail && (
                <div>
                  <p className="font-medium text-neutral-700">Email:</p>
                  <p>{quotationData.client.contactEmail}</p>
                </div>
              )}
              {quotationData.client.contactPhone && (
                <div>
                  <p className="font-medium text-neutral-700">Teléfono:</p>
                  <p>{quotationData.client.contactPhone}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OptimizedBasicInfo;