import React from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { Client } from '@shared/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const OptimizedBasicInfo: React.FC = () => {
  const {
    quotationData,
    updateClient,
    updateProjectName,
    updateProjectType,
    updateProjectDuration
  } = useOptimizedQuote();

  // Consultar lista de clientes
  const { data: clients, isLoading: isLoadingClients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    staleTime: 30000, // 30 segundos
    retry: 3,
    refetchOnWindowFocus: true,
  });

  // Consultar tipos de proyecto
  const { data: projectTypes, isLoading: isLoadingProjectTypes } = useQuery<{value: string, label: string}[]>({
    queryKey: ['/api/options/project-types'],
  });

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
        <div className="text-xs text-blue-600 mt-1">
          <a href="/clients/new" target="_blank" className="hover:underline">
            + Crear nuevo cliente
          </a>
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